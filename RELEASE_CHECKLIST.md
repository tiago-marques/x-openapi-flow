# Release Checklist

## Version 1.2.2

- [ ] Confirm npm package name: `x-openapi-flow`.
- [ ] Confirm optional GitHub Packages mirror target: `@tiago-marques/x-openapi-flow`.
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
- [ ] Validate local integration example:
  - [ ] `cd example-project && npm install && npm run validate`
- [ ] Create release tag (e.g., `v1.2.2`).
- [ ] Publish release notes based on `CHANGELOG.md`.
