# Python Templates

Handlebars templates used by `lib/sdk-generator.js` to render the Python SDK
(`x-openapi-flow generate-sdk --lang python`):

- `resource.hbs` — one module per resource, with a `{Resource}ResourceInstance`
  base class, one subclass per lifecycle state, and a `{Resource}Resource`
  service class.
- `init.hbs` — the package `__init__.py`, exposing a `FlowApiClient` that
  aggregates all generated resources.
- `http_client.hbs` — a zero-dependency `HttpClient` Protocol plus a stdlib
  `urllib`-backed implementation.
- `flow_helpers.hbs` — `ensure_prerequisites` and `run_flow` helpers.
