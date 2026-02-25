# Release Checklist

## Version 1.1.3

- [ ] Confirm npm package name: `x-openapi-flow`.
- [ ] Confirm product and DX changes in `CHANGELOG.md`.
- [ ] Run local tests:
  - [ ] `cd flow-spec && npm test`
- [ ] Validate core examples manually:
  - [ ] `npx x-openapi-flow validate examples/order-api.yaml --profile strict`
  - [ ] `npx x-openapi-flow validate examples/ticket-api.yaml --profile strict`
- [ ] Verify onboarding commands:
  - [ ] `npx x-openapi-flow doctor`
  - [ ] `cp flow-spec/examples/payment-api.yaml /tmp/x-openapi-flow-release-check.yaml`
  - [ ] `npx x-openapi-flow init /tmp/x-openapi-flow-release-check.yaml`
  - [ ] `npx x-openapi-flow validate /tmp/x-openapi-flow-release-check.yaml --profile strict`
- [ ] Ensure CI workflow is active in `.github/workflows/x-openapi-flow-validate.yml`.
- [ ] Create release tag (e.g., `v1.1.3`).
- [ ] Publish release notes based on `CHANGELOG.md`.
