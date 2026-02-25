# FAQ

## Does this replace OpenAPI?

No. It extends OpenAPI with `x-openapi-flow`.

## Do I need to edit generated OpenAPI manually?

No. Use sidecar (`init`/`apply`) to keep flows separate and re-applicable.

## Where can I find all sidecar fields and structure?

See [Sidecar Contract](Sidecar-Contract) for the complete schema and examples.

## Does it work with JSON and YAML files?

Yes, both.

## Does Swagger UI validate flows?

No. Swagger UI only renders data. Validation is done by the CLI (`validate`).

## I have legacy OpenAPI using `x-flow`. What now?

Migrate to `x-openapi-flow` for compatibility with current versions.

## Can I use this in CI?

Yes. Run `x-openapi-flow validate ... --profile strict --strict-quality` in your pipeline.

## Where is the full rollout guide (local + CI + PR checks)?

See [Adoption Playbook](Adoption-Playbook).

## Where are common errors and fixes documented?

See [Troubleshooting](Troubleshooting).
