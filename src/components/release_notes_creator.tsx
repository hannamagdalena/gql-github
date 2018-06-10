import { PullRequest, ChangeCategory } from "../pull_request";
import { PullRequestChangeCategorySelector } from "./pull_request_change_category_selector";
import { Dropdown } from "./dropdown";
import { Section } from "./section";
import { RepositorySelector } from "./repository_selector";
import { Markdown } from "./markdown";
import { Github, GithubTag } from "../github";
import * as React from "react";
import { Button, Snackbar, Slide } from "material-ui";
import { SlideProps } from "material-ui/transitions";
import { DefaultGrid } from "./default_grid";

export function TransitionLeft(props: SlideProps) {
  return <Slide direction="left" {...props} />;
}

class PullRequests extends React.Component<
  {
    pullRequests: PullRequest[];
    update: (pullRequests: PullRequest[]) => void;
  },
  {}
> {
  setPullRequest(pullRequest: PullRequest, index: number) {
    const pullRequests = [...this.props.pullRequests];
    pullRequests[index] = pullRequest;
    this.props.update(pullRequests);
  }

  render() {
    return (
      <div>
        {this.props.pullRequests.map((pullRequest, index) => (
          <PullRequestChangeCategorySelector
            key={pullRequest.id}
            pullRequest={pullRequest}
            onChange={updatedPullRequest =>
              this.setPullRequest(updatedPullRequest, index)
            }
          />
        ))}
      </div>
    );
  }
}

interface ReleaseNoteProps {
  releaseNote: string;
  Markdown: typeof Markdown;
  releaseTag: string;
  repo: string;
  github: Github;
}

class ReleaseNote extends React.Component<
  ReleaseNoteProps,
  { releaseCreated: boolean }
> {
  constructor(props: ReleaseNoteProps) {
    super(props);

    this.state = { releaseCreated: false };
  }

  async postRelease() {
    const release = {
      tag_name: this.props.releaseTag,
      target_commitish: "master",
      name: this.props.releaseTag,
      body: this.props.releaseNote,
      draft: false,
      prerelease: false
    };

    const response = await this.props.github.postRelease(
      this.props.repo,
      release
    );
    if (response.ok) {
      this.setState({ releaseCreated: true });
    }
  }
  render() {
    return (
      <div>
        <this.props.Markdown source={this.props.releaseNote} />
        <Button variant="raised" onClick={() => this.postRelease()}>
          Create Release
        </Button>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          autoHideDuration={2000}
          TransitionComponent={TransitionLeft}
          onClose={() => this.setState({ releaseCreated: false })}
          open={this.state.releaseCreated}
          message={<span>Release created</span>}
        />
      </div>
    );
  }
}

interface State {
  repositoryNames: string[];
  repo?: string;
  tags?: GithubTag[];
  defaultStartTag?: string;
  startTag?: string;
  releaseTag?: string;
  pullRequests: PullRequest[];
  releaseNote: string;
  releaseCreated: boolean;
  Markdown?: typeof Markdown;
}

interface Props {
  github: Github;
}

export class ReleaseNotesCreator extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      repositoryNames: [],
      pullRequests: [],
      releaseNote: "",
      releaseCreated: false
    };

    import("./markdown").then(module =>
      this.setState({ Markdown: module.Markdown })
    );
  }

  async getCommits() {
    const result = await this.props.github.compare(
      this.state.repo,
      this.state.startTag,
      this.state.releaseTag
    );

    const pullRequestRegex = new RegExp(/Merge pull request/);
    const pullRequestMerges = result.commits.filter(commit =>
      commit.commit.message.match(pullRequestRegex)
    );
    const pullRequests = pullRequestMerges.map(commit =>
      PullRequest.parseFrom(commit.commit.message)
    );

    this.setState({ pullRequests });
    this.updateReleaseNote();
  }

  async loadTags(repo: string) {
    const tags = await this.props.github.getTags(repo);
    const releases = await this.props.github.getReleases(repo);
    const firstMasterRelease = releases.find(
      release => !release.tagName.includes("_")
    );

    const defaultStartTag = firstMasterRelease
      ? firstMasterRelease.tagName
      : undefined;

    this.setState({
      tags,
      defaultStartTag,
      startTag: defaultStartTag
    });
  }

  selectRepository(repo: string) {
    this.setState({
      repo: repo,
      defaultStartTag: undefined,
      startTag: undefined,
      releaseTag: undefined,
      pullRequests: [],
      releaseNote: ""
    });
    return this.loadTags(repo);
  }

  renderTagsSection() {
    if (!this.state.repo || !this.state.tags) return <section />;

    const tagNames = this.state.tags.map(tag => tag.name);
    const disabledGetPRsButton =
      this.state.startTag === undefined || this.state.releaseTag === undefined;
    return (
      <Section heading="Range">
        <Dropdown
          label="Start Tag"
          options={tagNames}
          initialSelection={this.state.defaultStartTag}
          onSelect={tagName => this.setState({ startTag: tagName })}
        />
        <Dropdown
          label="End Tag"
          options={tagNames}
          onSelect={tagName => this.setState({ releaseTag: tagName })}
        />
        <Button
          variant="raised"
          onClick={() => this.getCommits()}
          disabled={disabledGetPRsButton}
        >
          Get merged PRs in range
        </Button>
      </Section>
    );
  }
  appendChangeCategory(category: ChangeCategory, releaseNote = "") {
    const pullRequests = this.state.pullRequests.filter(
      pullRequest => pullRequest.changeCategory === category
    );

    if (pullRequests.length === 0) return releaseNote;

    const innerText = pullRequests.join("\n");
    return `${releaseNote}**${category} Changes:**\n\n${innerText}\n\n`;
  }

  updateReleaseNote() {
    let releaseNote = this.appendChangeCategory(ChangeCategory.Breaking);
    releaseNote = this.appendChangeCategory(ChangeCategory.Basic, releaseNote);
    releaseNote = this.appendChangeCategory(
      ChangeCategory.Training,
      releaseNote
    );
    this.setState({ releaseNote });
  }

  renderPullRequestsSection() {
    if (this.state.pullRequests.length === 0) return <section />;

    return (
      <Section heading="Adjust Categories">
        <PullRequests
          pullRequests={this.state.pullRequests}
          update={(pullRequests: PullRequest[]) =>
            this.setState({ pullRequests }, () => this.updateReleaseNote())
          }
        />
      </Section>
    );
  }

  renderReleaseNoteSection() {
    if (
      this.state.releaseNote.length === 0 ||
      this.state.Markdown === undefined
    )
      return <section />;

    return (
      <Section heading="Release Note">
        <ReleaseNote {...this.props} {...this.state as any} />
      </Section>
    );
  }

  render() {
    return (
      <DefaultGrid small>
        <RepositorySelector
          github={this.props.github}
          onRepositorySelect={repo => this.selectRepository(repo)}
        />
        {this.renderTagsSection()}
        {this.renderPullRequestsSection()}
        {this.renderReleaseNoteSection()}
      </DefaultGrid>
    );
  }
}
