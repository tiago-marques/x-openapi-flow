# GitHub Actions Integration

## Goal

Validate x-openapi-flow lifecycle rules in CI with a single reusable step.

## Official Action

Use the official action from this repository:

```yaml
- name: Validate OpenAPI flow rules
  uses: tiago-marques/x-openapi-flow/.github/actions/validate@main
  with:
    openapi-file: openapi.flow.yaml
    profile: strict
    strict-quality: "true"
```

## Minimal Workflow

```yaml
name: validate-openapi-flow

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate OpenAPI flow rules
        uses: tiago-marques/x-openapi-flow/.github/actions/validate@main
        with:
          openapi-file: openapi.flow.yaml
          profile: strict
          strict-quality: "true"
```

## Optional Inputs

- `semantic`: enable semantic modeling checks (`"true"` or `"false"`)
- `format`: output format (`pretty` or `json`)
- `config`: path to `x-openapi-flow.config.json`
- `working-directory`: run validation inside a subdirectory
- `node-version`: Node.js runtime for action execution
- `cli-version`: x-openapi-flow npm version (`latest`, `1.6.4`, etc.)

## Tip

Pin `cli-version` and action ref to a tag when you need fully reproducible CI behavior.
