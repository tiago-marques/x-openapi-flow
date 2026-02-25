# Release Checklist

## Version 1.1.1

- [ ] Confirm npm package name: `x-openapi-flow`.
- [ ] Confirm product and DX changes in `CHANGELOG.md`.
- [ ] Run local tests:
  - [ ] `cd flow-spec && npm test`
- [ ] Validate core examples manually:
  - [ ] `npx x-openapi-flow validate examples/order-api.yaml --profile strict`
  - [ ] `npx x-openapi-flow validate examples/ticket-api.yaml --profile strict`
- [ ] Verify onboarding commands:
  - [ ] `npx x-openapi-flow doctor`
  - [ ] `npx x-openapi-flow init /tmp/x-flow-release-check.yaml --title "Release Check API"`
  - [ ] `npx x-openapi-flow validate /tmp/x-flow-release-check.yaml --profile strict`
- [ ] Ensure CI workflow is active in `.github/workflows/x-openapi-flow-validate.yml`.
- [ ] Create release tag (e.g., `v1.1.1`).
- [ ] Publish release notes based on `CHANGELOG.md`.
