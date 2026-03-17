# Release Notes v1.3.4

Date: 2026-03-16

## Highlights

- Fixed npm publishing automation to use the secret mapping configured in the repository.
- Kept GitHub Packages publishing on the dedicated `GH_PACKAGES_TOKEN_V2` path.
- Re-issued the release so npm and GitHub Packages can publish successfully from GitHub Release automation.

## Validation

- Release metadata updated to 1.3.4.
- Publish workflows aligned with repository secret names.