# Adapters Architecture

## Overview

Output adapters transform the x-openapi-flow intermediate model into format-specific outputs. They live under `x-openapi-flow/adapters/` and are organized by subdomain so the core library stays isolated and each adapter can grow independently.

## Folder structure

```
x-openapi-flow/adapters/
├── shared/
│   └── helpers.js          ← toTitleCase, pathToPostmanUrl, buildLifecycleSequences
├── docs/
│   └── doc-adapter.js      ← export-doc-flows (Markdown / JSON lifecycle docs)
├── collections/
│   ├── postman-adapter.js  ← generate-postman (flow-journey Postman collection)
│   └── insomnia-adapter.js ← generate-insomnia (flow-organized Insomnia workspace)
├── ui/
│   ├── swagger-ui/         ← x-openapi-flow-plugin.js (Swagger UI plugin)
│   ├── redoc/              ← x-openapi-flow-redoc-plugin.js (Redoc panel plugin)
│   └── redoc-adapter.js    ← generate-redoc (self-contained Redoc package)
└── flow-output-adapters.js ← barrel — re-exports all adapters for CLI import
```

## Subdomain responsibilities

| Subdomain | Description |
|---|---|
| `shared/` | Pure utility functions shared across two or more adapters. No I/O, no side effects. |
| `docs/` | Human-readable lifecycle documentation (Markdown, JSON). Used by portals, wikis, Redoc. |
| `collections/` | API client test collections (Postman, Insomnia). Focused on lifecycle journeys and prerequisite orchestration. |
| `ui/` | In-browser UI plugin scripts and static package generators. |

## Barrel import

The CLI imports from the barrel:

```js
const { exportDocFlows, generatePostmanCollection, ... } = require("../adapters/flow-output-adapters");
```

The barrel delegates to each domain adapter. This means the CLI does not need to change when internal adapter structure evolves.

## Adding a new adapter

1. Identify the subdomain (`docs/`, `collections/`, `ui/`, or a new one).
2. Create `adapters/<subdomain>/<name>-adapter.js` exporting a single named function.
3. If you need shared utilities (lifecycle walk, URL templating), use `adapters/shared/helpers.js` — add new helpers there if reusable.
4. Register the export in `adapters/flow-output-adapters.js` (barrel).
5. Wire the CLI command in `bin/x-openapi-flow.js`.
6. Add tests in `tests/cli/` (unit-style) and `tests/integration/` (cross-adapter scenario).

## Data flow

```
OpenAPI file
  └─▶ loadApi()            (lib/validator.js)
        └─▶ buildIntermediateModel()  (lib/sdk-generator.js)
              ├─▶ docs/doc-adapter       → Markdown / JSON
              ├─▶ collections/postman    → Postman collection JSON
              ├─▶ collections/insomnia   → Insomnia workspace JSON
              └─▶ ui/redoc-adapter       → Redoc package (HTML + plugin + spec)
```

All adapters receive the same intermediate model, so they are guaranteed to produce consistent outputs for the same spec.

## UI plugins

Browser-side plugin scripts (`swagger-ui/`, `redoc/`) are standalone files loaded directly in HTML pages. They do not have Node.js dependencies and must be self-contained. Test them with `tests/plugins/plugin-ui.test.js` using a mock browser environment.

## Related

- [CLI Reference](CLI-Reference.md) — CLI flags and examples for each adapter command.
- [Integration Testing](Integration-Testing.md) — how to write cross-adapter integration tests.
- [SDK Generator](../sdk/README.md) — the intermediate model that adapters consume.
