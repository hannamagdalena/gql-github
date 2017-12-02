import { Category } from "./category";
import * as readline from "readline";
import { promisify } from "util";
import { exec } from "child_process";
import * as request from "request-promise-native";
const sh = promisify(exec);

type QuestionCallback = () => Promise<{}>;
export class ReleaseNoteCreator {
  private categories = [
    new Category("breaking changes", "b"),
    new Category("training changes", "t"),
    new Category("basic changes")
  ];
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  async getCommitsBetweenTags(start: string, end: string, repo: string) {
    const { stdout, stderr } = await sh(
      `cd ~/Documents/${repo} && \
    git log ${start}..${end} | \
    grep "Merge pull" --after-context=2`
    );

    if (stderr) throw new Error(stderr);

    return stdout.split("\n");
  }

  noneWhitespaceLinesReduce(accumulator: string[], line: string) {
    if (/\S/.test(line) && line.indexOf("--") !== 0) accumulator.push(line);

    return accumulator;
  }

  pullRequestCommitsReduce(
    accumulator: string[],
    line: string,
    index: number,
    array: string[]
  ) {
    const pullRequestNumberRegex = new RegExp(/#\d*/);
    if (index % 2 === 0) return accumulator;

    const pullRequestNumberMatch = array[index - 1].match(
      pullRequestNumberRegex
    );
    const result = `- ${line.trim()} (${pullRequestNumberMatch})`;
    accumulator.push(result);
    return accumulator;
  }

  async filterPullRequestCommits(lines: string[]) {
    const importantLines = lines.reduce(
      this.noneWhitespaceLinesReduce,
      [] as string[]
    );

    const pullRequests = importantLines.reduce(
      this.pullRequestCommitsReduce,
      [] as string[]
    );

    return pullRequests;
  }

  private assignToCategoryForAnswer(answer: string, pullRequest: string) {
    this.categories.some(catgory => catgory.addIfMatching(answer, pullRequest));
  }

  private createQuestion(pullRequest: string) {
    return new Promise(resolve => {
      this.rl.question(`Category for '${pullRequest}'?`, answer => {
        this.assignToCategoryForAnswer(answer, pullRequest);
        resolve();
      });
    });
  }

  private createQuestions(pullRequests: string[]): QuestionCallback[] {
    return pullRequests.map(pullRequest => {
      return () => this.createQuestion(pullRequest);
    });
  }
  async assignPRsToCategory(questions: QuestionCallback[]) {
    console.log("Assign PRs to category:");
    this.categories.forEach(category => category.printLegendLine());

    for (const question of questions) await question();

    console.log("\n\n---------- RELEASE NOTES ----------\n");
    const releaseDescription = this.categories
      .map(category => category.toString())
      .join("\n");
    console.log(releaseDescription);

    return releaseDescription;
  }

  private createRelease(tag: string, description: string) {
    return {
      tag_name: tag,
      target_commitish: "master",
      name: tag,
      body: description,
      draft: false,
      prerelease: false
    };
  }

  async postRelease(owner: string, repo: string, release: any, token: string) {
    const options: request.Options = {
      method: "POST",
      uri: `https://api.github.com/repos/${owner}/${repo}/releases`,
      body: {
        ...release
      },
      auth: { bearer: token },
      headers: { "User-Agent": owner },
      json: true
    };

    const response = await request(options);

    console.log("Release created: ", response.url);
  }

  async create(
    start: string,
    end: string,
    owner: string,
    repo: string,
    token: string
  ) {
    const commits = await this.getCommitsBetweenTags(start, end, repo);
    const pullRequests = await this.filterPullRequestCommits(commits);
    const questions = this.createQuestions(pullRequests);
    const releaseDescription = await this.assignPRsToCategory(questions);
    const release = this.createRelease(end, releaseDescription);
    await this.postRelease(owner, repo, release, token);
  }
}
