import * as program from "commander";
import * as request from "request-promise-native";
import * as fs from "fs";
import { promisify } from "util";
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const token = process.env.TOKEN;
program
  .version("0.0.1")
  .option("--owner <repository owner>", "Owner of the repository")
  .option("--repo <repository name>", "Name of the repository")
  .description(`TBD`)
  .parse(process.argv);

if (program.repo === undefined || program.owner === undefined) {
  console.error("Input arguments missing! See help output:");
  program.outputHelp();
  process.exit(1);
}

async function getOrgRepos(organisation: string) {
  const options: request.Options = {
    method: "GET",
    uri: `https://api.github.com/orgs/${organisation}/repos`,
    auth: { bearer: token },
    headers: { "User-Agent": organisation },
    json: true
  };

  return await request(options);
}

async function getOrgOwnRepos(organisation: string) {
  const filename = `org_repos_${organisation}.json`;
  if (fs.existsSync(filename)) {
    return JSON.parse(await readFile(filename, "utf8"));
  }
  const repos = await getOrgRepos(program.owner);
  const ownRepos = repos
    .filter((repo: any) => !repo.fork)
    .map((repo: any) => repo.name);

  await writeFile(filename, JSON.stringify(ownRepos));
  return ownRepos;
}

async function getStatsFor(owner: string, repo: string) {
  const filename = `stats_${repo}.json`;
  if (fs.existsSync(filename)) {
    const readFile = promisify(fs.readFile);
    return JSON.parse(await readFile(filename, "utf8"));
  }
  const options: request.Options = {
    method: "GET",
    uri: `https://api.github.com/repos/${owner}/${repo}/stats/contributors`,
    auth: { bearer: token },
    headers: { "User-Agent": owner },
    json: true
  };

  const response = await request(options);
  console.log(response);
  await writeFile(filename, JSON.stringify(response));

  return response;
}

function getCommitsPerAuthor(data: any[]) {
  return data.reduce((acc, userEntry) => {
    acc[userEntry.author.login] = userEntry.total;
    return acc;
  }, {});
}

function getCommitsPerAuthorSince(data: any[], startTime: Date) {
  const unixTime = Math.round(startTime.getTime() / 1000);
  return data.reduce((acc, userEntry) => {
    const weeksInRange = userEntry.weeks.filter(
      (week: any) => week.w > unixTime
    );
    const commits = weeksInRange.reduce(
      (sum: number, week: any) => sum + week.c,
      0
    );
    acc[userEntry.author.login] = commits;
    return acc;
  }, {});
}

interface AuthorToCommits {
  [author: string]: number;
}

function sumUpForAuthor(
  repoStats: {
    repo: string;
    stats: AuthorToCommits;
  }[]
): AuthorToCommits {
  return repoStats.reduce(
    (acc, repo) => {
      for (let [key, value] of Object.entries(repo.stats)) {
        if (acc[key] === undefined) {
          acc[key] = value;
        } else {
          acc[key] += value;
        }
      }
      return acc;
    },
    {} as AuthorToCommits
  );
}

function printAuthorStats(desc: string, stats: AuthorToCommits) {
  console.log("\n\n" + desc + "\n");
  const entries = Object.entries(stats);
  const sorted = entries.sort((a, b) => a[1] - b[1]);

  sorted.forEach(([author, commits]) =>
    console.log(author, "\t", commits.toString().padStart(5, " "))
  );
}

async function main() {
  try {
    const ownRepos = await getOrgOwnRepos(program.owner);
    const repoStats2017 = await Promise.all(
      ownRepos.map(async (repo: any) => {
        const data = await getStatsFor(program.owner, repo);
        const commitStats2017 = getCommitsPerAuthorSince(
          data,
          new Date(2017, 0)
        );
        return { repo, stats: commitStats2017 };
      })
    );

    const overallStats2017 = sumUpForAuthor(repoStats2017 as any);
    printAuthorStats("2017", overallStats2017);

    const repoStats = await Promise.all(
      ownRepos.map(async (repo: any) => {
        const data = await getStatsFor(program.owner, repo);
        const commitStats = getCommitsPerAuthor(data);
        return { repo, stats: commitStats };
      })
    );

    const overallStats = sumUpForAuthor(repoStats as any);
    printAuthorStats("Overall", overallStats);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();