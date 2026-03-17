# Release Notes v1.3.5

Date: 2026-03-16

## Highlights

- Improved CLI UX in `x-openapi-flow` with `help [command]`, command-level help, `version/--version`, typo suggestions, `--verbose`, and shell completion (`completion bash|zsh`).
- Hardened CI validation workflow with Node.js matrix (18/20/22), full test execution, quality-warning scenario coverage, and explicit strict-profile failure assertion for non-terminating flow examples.
- Renamed the Swagger UI example folder to `example/swagger-ui` and refreshed all example READMEs (`swagger-ui`, `redoc`, `postman`, `insomnia`) with a consistent create/apply/validate/generate/test flow.
- Removed duplicate `schema` entry from package publish `files` metadata and aligned integration tests with the renamed Swagger UI example path.
- Published release `v1.3.5` to both npm and GitHub Packages through GitHub Release automation.

## Validation

- Full local test suite executed successfully in `x-openapi-flow` before release.
- GitHub Actions release workflows completed successfully:
  - Publish to npm (Token)
  - Publish to GitHub Packages
- Release URL: https://github.com/tiago-marques/x-openapi-flow/releases/tag/v1.3.5
