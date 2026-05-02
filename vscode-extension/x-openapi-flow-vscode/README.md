# x-openapi-flow VS Code Extension (MVP)

Validate OpenAPI lifecycle metadata directly from VS Code using x-openapi-flow.

## Commands

- `x-openapi-flow: Validate Current File`
- `x-openapi-flow: Validate Workspace File`

## Settings

- `xOpenApiFlow.cliVersion` (default: `latest`)
- `xOpenApiFlow.profile` (`core`, `relaxed`, `strict`)
- `xOpenApiFlow.strictQuality` (default: `true`)
- `xOpenApiFlow.semantic` (default: `false`)

## How it works

The extension executes:

`npx --yes x-openapi-flow@<cliVersion> validate <file> --format json ...`

and maps returned issues to VS Code diagnostics.

## Notes

This is an MVP scaffold kept in-repo for iterative improvement before Marketplace publication.
