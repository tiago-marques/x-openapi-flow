# Release Notes v1.3.7

Date: 2026-03-16

## Highlights

- Added automated synchronization from the repository root README to the published package README.
- Added a dedicated sync script so npm package documentation stays aligned with the main project README.
- Wired the package release flow to run README synchronization automatically during `prepack`.
- Updated the release checklist to include README sync verification and the current Swagger UI example path.

## Validation

- Full local test suite executed successfully in `x-openapi-flow` before release.
- Package version bumped from `1.3.6` to `1.3.7`.
- Release prepared for publication to npm and GitHub Packages via GitHub Release automation.
