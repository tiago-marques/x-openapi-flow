# Release Checklist

## Version 1.2.3

- [ ] Confirm npm package name: `x-openapi-flow`.
- [ ] Confirm optional GitHub Packages mirror target: `@tiago-marques/x-openapi-flow`.
- [ ] Confirm product and DX changes in `CHANGELOG.md`.
- [ ] Run local tests:
  - [ ] `cd flow-spec && npm test`
- [ ] Validate core examples manually:
  - [ ] `npx x-openapi-flow validate examples/order-api.yaml --profile strict`
  - [ ] `npx x-openapi-flow validate examples/ticket-api.yaml --profile strict`
  - [ ] `npx x-openapi-flow lint examples/order-api.yaml`
  - [ ] `npx x-openapi-flow graph examples/order-api.yaml --format json`
- [ ] Verify onboarding commands:
  - [ ] `npx x-openapi-flow doctor`
  - [ ] `cp flow-spec/examples/payment-api.yaml /tmp/x-openapi-flow-release-check.yaml`
  - [ ] `npx x-openapi-flow init /tmp/x-openapi-flow-release-check.yaml`
  - [ ] `npx x-openapi-flow diff /tmp/x-openapi-flow-release-check.yaml --format pretty`
  - [ ] `npx x-openapi-flow validate /tmp/x-openapi-flow-release-check.yaml --profile strict`
  - [ ] `npx x-openapi-flow lint /tmp/x-openapi-flow-release-check.yaml`
- [ ] Ensure CI workflow is active in `.github/workflows/x-openapi-flow-validate.yml`.
- [ ] Review documentation consistency:
  - [ ] `docs/wiki/Adoption-Playbook.md`
  - [ ] `docs/wiki/Troubleshooting.md`
  - [ ] `docs/wiki/Real-Examples.md`
- [ ] Validate local integration example:
  - [ ] `cd example-project && npm install && npm run validate`
- [ ] Create release tag (e.g., `v1.2.3`).
- [ ] Publish release notes based on `CHANGELOG.md`.
