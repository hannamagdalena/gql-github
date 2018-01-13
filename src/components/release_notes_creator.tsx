import { Dropdown } from "./dropdown";
import { getRepositoryNames, getRequestGithub } from "../github";
import { Owner } from "./owner";
import * as React from "react";

interface State {
  token: string;
  repositoryNames: string[];
  owner: string;
  repo?: string;
  releases?: any[];
  startRelease?: string;
  endRelease?: string;
}

export class ReleaseNotesCreator extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      owner: "skillslab",
      repositoryNames: [],
      token: JSON.parse(window.localStorage.github).access_token
    };
  }

  handleOwnerSubmit(owner: string) {
    this.setState({ owner });
    this.loadRepos(owner);
  }

  async loadRepos(owner: string) {
    try {
      const repositoryNames = await getRepositoryNames(owner, this.state.token);
      this.setState({
        repositoryNames
      });
    } catch (error) {
      console.error(error);
    }
  }

  async getCommits() {
    const response = await getRequestGithub(
      `repos/${this.state.owner}/${this.state.repo}/compare/${
        this.state.startRelease
      }...${this.state.endRelease}`,
      this.state.token
    );

    const result = await response.json();
    console.log(result);
  }

  async loadReleases(repo: string) {
    const response = await getRequestGithub(
      `repos/${this.state.owner}/${repo}/releases`,
      this.state.token
    );
    const result = await response.json();
    this.setState({ releases: result });
  }

  selectRepository(repo: string) {
    this.setState({ repo: repo });
    return this.loadReleases(repo);
  }

  renderRepositorySelection() {
    if (this.state.repositoryNames.length === 0) {
      return <div />;
    }

    return (
      <Dropdown
        options={this.state.repositoryNames}
        onSelect={repo => this.selectRepository(repo)}
      />
    );
  }

  renderReleasesSection() {
    if (!this.state.repo || !this.state.releases) return <section />;

    const releaseNames = this.state.releases.map(release => release.tag_name);
    return (
      <section>
        <h3>Select range</h3>
        <label>
          Start
          <Dropdown
            options={releaseNames}
            onSelect={tagName => this.setState({ startRelease: tagName })}
          />
        </label>
        <label className="ph2">
          End
          <Dropdown
            options={releaseNames}
            onSelect={tagName => this.setState({ endRelease: tagName })}
          />
        </label>
        <button onClick={() => this.getCommits()}>
          Get merged PRs in range
        </button>
      </section>
    );
  }

  render() {
    return (
      <div>
        <Owner updateOwner={owner => this.handleOwnerSubmit(owner)} />
        {this.renderRepositorySelection()}
        {this.renderReleasesSection()}
      </div>
    );
  }
}
