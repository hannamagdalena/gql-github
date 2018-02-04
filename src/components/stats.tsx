import { OverallPlot } from "./overall_plot";
import * as React from "react";
import { getCommitsPerAuthorInDateRange } from "../stats_helper";
import * as Plotly from "plotly.js";
import PlotlyChart from "react-plotlyjs-ts";
import { CommitsOverTimePlot } from "./commits_over_time_plot";
import { GithubData, GithubAuthorData, Github } from "../github";
import { OwnerDropdown } from "./owner_dropdown";
import { Typography, Grid } from "material-ui";
import { Section } from "./section";
import LinearProgress from "material-ui/Progress/LinearProgress";

interface Props {
  github: Github;
}

interface State {
  error: any;
  repositoryNames: string[];
  data: GithubData[];
  startedLoading: boolean;
}

function sum(array: number[]) {
  return array.reduce((sum, value) => sum + value, 0);
}

export class Stats extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      repositoryNames: [],
      data: [],
      startedLoading: false
    };
  }

  renderGraph(title: string, data: GithubData) {
    if (data === undefined || data.map === undefined) {
      console.error("No data for", title, data);
      return <div>{`No data returned for ${title} (${data})`}</div>;
    }

    const authorTimeLine = data.map(author => this.traceForAuthor(author));

    return <CommitsOverTimePlot title={title} data={authorTimeLine as any} />;
  }

  private getYearsArray() {
    const startYear = 2013;
    const endYear = new Date().getFullYear();
    return Array.from(new Array(endYear - startYear), (_, i) => i + startYear);
  }

  renderYearGraph(title: string, data: GithubData) {
    const years = this.getYearsArray();
    const statsPerYear = years.map(year =>
      getCommitsPerAuthorInDateRange(
        data,
        new Date(year, 0),
        new Date(year + 1, 0)
      )
    );

    const authors = Object.keys(statsPerYear[0]);
    const x = years.map((year, index) => {
      const commitsInYear = sum(Object.values(statsPerYear[index]));
      return `${year} (${commitsInYear})`;
    });

    const traces = authors.map((author: string) => {
      const yValues = statsPerYear.map(year => year[author]);
      const authorSum = data.find(d => d.author.login === author).total;
      return {
        x,
        y: yValues,
        type: "bar",
        textposition: "outside",
        text: yValues,
        hoverinfo: "name",
        name: `${author} ${authorSum}`
      };
    });

    const overallCommitCount = sum(data.map(authorData => authorData.total));

    const layout: Partial<Plotly.Layout> = {
      title: `Yearly commits in ${title} ${overallCommitCount}`,
      xaxis: {
        title: "time"
      },
      yaxis: {
        title: "commit count"
      }
    };

    return <PlotlyChart data={traces} layout={layout} />;
  }

  private traceForAuthor(statsForAuthor: GithubAuthorData) {
    return {
      type: "scatter",
      mode: "lines",
      name: statsForAuthor.author.login,
      x: statsForAuthor.weeks.map((week: any) => new Date(week.w * 1000)),
      y: statsForAuthor.weeks.map((week: any) => week.c)
    };
  }

  async selectOwner(owner: string) {
    this.setState({ startedLoading: true });

    this.props.github.owner = owner;
    const repositoryNames = await this.props.github.getRepositoryNames();

    const data = await Promise.all(
      repositoryNames.map(repo => this.props.github.getStats(repo))
    );

    this.setState({ data, repositoryNames });
  }

  renderRepoGraph(repo: string, index: number) {
    const data = this.state.data[index];

    if (!data) return null;

    return (
      <Section key={repo}>
        <Typography type="headline" paragraph>
          {repo}
        </Typography>
        {this.renderGraph(repo, data)}
        {this.renderYearGraph(repo, data)}
      </Section>
    );
  }

  renderRepositorySelection() {
    return (
      <Section>
        <Typography type="headline" paragraph>
          Repository
        </Typography>
        <OwnerDropdown
          github={this.props.github}
          onSelect={owner => this.selectOwner(owner)}
        />
      </Section>
    );
  }

  renderStatsSection() {
    if (!this.state.startedLoading) return null;

    if (this.state.data.length === 0)
      return (
        <Section>
          <Typography type="headline" paragraph>
            Stats
          </Typography>
          <LinearProgress />
        </Section>
      );

    return (
      <div>
        <Section>
          <Typography type="headline" paragraph>
            Overall
          </Typography>
          <OverallPlot
            reposData={this.state.data}
            repositoryNames={this.state.repositoryNames}
          />
        </Section>
        {this.state.repositoryNames.map((item, index) =>
          this.renderRepoGraph(item, index)
        )}
      </div>
    );
  }
  render() {
    return (
      <Grid container spacing={24} justify="center">
        <Grid item xs={12}>
          {this.renderRepositorySelection()}
          {this.renderStatsSection()}
        </Grid>
      </Grid>
    );
  }
}
