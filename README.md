# x-openapi-flow

[![npm version](https://img.shields.io/npm/v/x-openapi-flow?label=npm%20version)](https://www.npmjs.com/package/x-openapi-flow)
[![npm downloads](https://img.shields.io/npm/dm/x-openapi-flow?label=npm%20downloads)](https://www.npmjs.com/package/x-openapi-flow)
![node](https://img.shields.io/badge/node-%3E%3D18-339933)
![license](https://img.shields.io/npm/l/x-openapi-flow)
[![CI](https://github.com/tiago-marques/x-openapi-flow/actions/workflows/x-openapi-flow-validate.yml/badge.svg)](https://github.com/tiago-marques/x-openapi-flow/actions/workflows/x-openapi-flow-validate.yml)
[![open issues](https://img.shields.io/github/issues/tiago-marques/x-openapi-flow)](https://github.com/tiago-marques/x-openapi-flow/issues)
[![last commit](https://img.shields.io/github/last-commit/tiago-marques/x-openapi-flow)](https://github.com/tiago-marques/x-openapi-flow/commits/main)

`x-openapi-flow` is the package/CLI used to validate the OpenAPI `x-flow` extension and describe resource lifecycle workflows (not limited to payments).

It allows documenting, per operation, the current state (`current_state`) and possible transitions (`transitions`) with explicit triggers.

## Quickstart (3 commands)

```bash
cd flow-spec
npm install
node bin/x-openapi-flow.js validate examples/order-api.yaml
```

## Structure

- `flow-spec/schema/flow-schema.json`: extension JSON Schema contract.
- `flow-spec/lib/validator.js`: validation engine (schema + graph consistency).
- `flow-spec/bin/x-openapi-flow.js`: validation CLI.
- `flow-spec/examples/*.yaml`: OpenAPI examples with `x-flow`.
- `.github/workflows/x-openapi-flow-validate.yml`: CI validation workflow example.

## Minimum Contract (`x-flow`)

Each `x-flow` block must include:

- `version`: extension contract version (`"1.0"`)
- `id`: unique identifier of the flow step
- `current_state`: state represented by the operation

## How to Run

```bash
cd flow-spec
npm install
npm test
```

## CLI

```bash
x-openapi-flow validate <openapi-file> [--format pretty|json] [--profile core|relaxed|strict] [--strict-quality] [--config path]
x-openapi-flow init [output-file] [--title "My API"]
x-openapi-flow graph <openapi-file> [--format mermaid|json]
x-openapi-flow doctor [--config path]
```

Package installation:

```bash
npm install x-openapi-flow
```

Try instantly with npx:

```bash
npx --yes x-openapi-flow init my-api.yaml --title "My API"
```

Installed global command:

```bash
x-openapi-flow
```

Examples:

```bash
x-openapi-flow validate examples/payment-api.yaml
x-openapi-flow validate examples/order-api.yaml
x-openapi-flow validate examples/order-api.yaml --profile relaxed
x-openapi-flow validate examples/order-api.yaml --strict-quality
x-openapi-flow validate examples/ticket-api.yaml --format json
x-openapi-flow validate examples/quality-warning-api.yaml
x-openapi-flow validate examples/quality-warning-api.yaml --strict-quality
x-openapi-flow validate examples/non-terminating-api.yaml --format json
x-openapi-flow init my-api.yaml --title "Orders API"
x-openapi-flow graph examples/order-api.yaml
x-openapi-flow doctor
```

## Validation Profiles

- `strict` (default): schema + advanced graph checks as errors; quality as warnings (or errors with `--strict-quality`).
- `relaxed`: schema and orphan checks as errors; advanced/quality checks as warnings.
- `core`: validates only schema and orphan states.

## File-Based Configuration

You can use `x-openapi-flow.config.json` in the current directory (or pass it via `--config`):

```json
{
	"profile": "strict",
	"format": "pretty",
	"strictQuality": false
}
```

Example file: `flow-spec/x-openapi-flow.config.example.json`.

## What Gets Validated

1. **Schema validation**: enforces shape and required fields of `x-flow`.
2. **Graph validation**: detects orphan `target_state` entries (without matching `current_state` in any operation).
3. **Advanced graph checks**:
	- requires at least one initial state (`indegree = 0`)
	- requires at least one terminal state (`outdegree = 0`)
	- detects unreachable states from initial states
	- detects cycles (flow must be acyclic)
4. **Quality checks**:
	- warns when there are multiple initial states
	- warns about duplicate transitions (`from + to + trigger_type`)
	- warns about states with no path to any terminal state

By default, quality checks produce **warnings**. Use `--strict-quality` to treat them as errors (exit code 1).

## Graph Visualization

`x-openapi-flow graph` generates Mermaid (or JSON) output for the state flow, helping review between developers and architecture teams.

Example:

```bash
x-openapi-flow graph examples/order-api.yaml
```

## Ready-to-Use CI

There is a ready-to-use workflow in `.github/workflows/x-openapi-flow-validate.yml`.
To adapt it to your real OpenAPI files, update the paths in the `Validate x-openapi-flow examples` step.

## Changelog

Version history is tracked in `CHANGELOG.md`.
Release notes are available in `RELEASE_NOTES_v1.1.1.md`.

## Included Examples

- `payment-api.yaml` (financial)
- `order-api.yaml` (e-commerce/logistics)
- `ticket-api.yaml` (support)
- `quality-warning-api.yaml` (demonstrates quality warnings)
- `non-terminating-api.yaml` (demonstrates `non_terminating_states`)