# Pitt CSC Website

The Pitt CSC website, built with Gatsby, Tailwind, and Framer Motion.

## Run locally

With a compatible Node/npm runtime (see [CONTRIBUTING.md](CONTRIBUTING.md)), run:

```sh
npm ci --legacy-peer-deps
npm run develop
```

Open http://localhost:8000. No Docker, Go, or Supabase is required for the public
site on `master`. Preserve existing env files; hosted credentials are optional.

Agents should follow [AGENTS.md](AGENTS.md); [CLAUDE.md](CLAUDE.md) imports the same
instructions. The [repository guide](docs/REPOSITORY.md) maps active code, content
sources, public tools, verification, and known limitations. CRM work is separate
on `crm-expansion`.

## Content sources

JSON in `content/` can be sourced through Gatsby's JSON transformer and GraphQL.
Inspect the active page consumer before editing: officers/leads use
`src/components/data.js`, sponsors are defined in their page, and initiatives
use `src/data/` modules. Use GraphQL where content is already sourced that way;
do not migrate data sources as incidental cleanup.
