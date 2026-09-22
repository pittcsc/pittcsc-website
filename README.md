# Pitt CSC Website
The new Pitt CSC Website, now built with Gatsby, Tailwind, and Framer Motion.

## How to run locally

Install [mise](https://mise.jdx.dev/installing-mise.html) and start Docker Desktop
once. On macOS with Homebrew, install mise with `brew install mise`.

Then, from your checkout:

```sh
mise trust
mise run setup
mise run dev
```

Open http://localhost:8000. Mise installs the pinned Node and Go runtimes;
setup installs dependencies, starts local Supabase, and creates missing local
env files. No nvm, global npm packages, or shell configuration is required.
First setup downloads runtimes, dependencies, and Docker images and can take
several minutes. Later sessions just need `mise run dev` with Docker running.

See [CONTRIBUTING.md](CONTRIBUTING.md) for configuration, checks, and troubleshooting.

## Accessing Data in Content Folder

JSON files added to the Content folder are accessible via [GraphQL](https://www.gatsbyjs.com/docs/graphql/) using the [JSON gatsby transformer plugin](https://www.gatsbyjs.com/plugins/gatsby-transformer-json/).

Accessing site content through GraphQL queries is preferred over directly importing the JSON files to components.
