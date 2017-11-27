# gql-github

Tool to communicat with [github](github.com) using
[GraphQL](http://graphql.org).

The main purpose is just to play with GraphQL.

# Installation and building

```bash
yarn
yarn run tsc-watch
```

# Release Notes

Currently the tool can get the last release and output it's tag name and
description.

```bash
TOKEN={github personal access token} node src/main.js --owner={repository owner} --repo={repositroy name}
```

Adding a tag name (for example `v1.2.3` as parameter search for a release with
this tag in the last 10 releases.

```bash
TOKEN={github personal access token} node src/main.js --owner={repository owner} --repo={repositroy name} --release=v1.2.3
```

Generating a personal access token for github is described in
[Creating a personal access token for the command line](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/).
