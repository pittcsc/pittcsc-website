# Pitt CSC Website

The Pitt CSC website uses Gatsby, Tailwind, and Framer Motion for its public
pages and dashboard, with a Go API and Supabase for club accounts and CRM data.

## Run locally

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

See [development instructions](docs/DEVELOPMENT.md) for configuration and
checks, [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance, and the
[repository guide](docs/REPOSITORY.md) for active content sources.

## Accessing Data in Content Folder

JSON files in `content/` are available through Gatsby's JSON transformer and
GraphQL. Check the page's existing data source before adding or changing content;
not every page reads those JSON files. See the [code map](docs/REPOSITORY.md#code-map-and-boundaries).
