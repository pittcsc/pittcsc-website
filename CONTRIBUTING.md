# Contributing

For local setup, runtime notes, and testing commands, see
[development instructions](docs/DEVELOPMENT.md). The
[repository guide](docs/REPOSITORY.md) maps the code and active content sources.

## Issues

- For bugs, include the affected route, reproduction steps, expected and actual
  behavior, and relevant browser/runtime versions.
- For feature requests, describe the use case and whether it concerns the public
  site or CRM. Discuss substantial changes before starting implementation.
- Keep credentials, private member data, and raw calendars out of reports and
  screenshots; use sanitized examples.

## Pull requests

- Target `master` for public-site work and `crm-expansion` for CRM work.
  Do not bundle the CRM branch into a public-site PR.
- Keep the PR focused; separate dependency upgrades, runtime changes, and
  deployment changes from unrelated features or documentation.
- Describe what changed and why, and link the relevant issue when available.
- Follow the [verification instructions](docs/DEVELOPMENT.md#verification) and
  report checks run, failures, skipped tests, and any remaining limitations.
  Include appropriate screenshots for UI changes without exposing private data.
- Update the relevant documentation when setup or behavior changes.
