# x-openapi-flow v1.2.1

## Summary

This release improves the sidecar authoring experience and AI-assisted workflows, with better defaults and richer visualization.

## Highlights

- Added `llm.txt` to guide AI assistants when populating sidecar files.
- Added Copilot-ready documentation in the root README and wiki.
- Improved `init` scaffold to generate complete `x-openapi-flow` placeholders (no `null` entries).
- Added fallback operationId support for operations that do not define `operationId`.
- Extended `graph` to support sidecar files directly (`{context}-openapi-flow.(json|yaml)`).
- Enhanced Swagger UI plugin with a global Flow Overview (Mermaid image) while preserving operation-level cards.
- Expanded `example-project` with YAML + JSON sidecar examples and dedicated apply scripts.

## Compatibility

- No breaking changes to existing `x-openapi-flow` payload shape.
- Existing OpenAPI + sidecar workflows remain compatible.

## Recommended Upgrade Steps

```bash
npm install x-openapi-flow@1.2.1
```

Then run:

```bash
x-openapi-flow init openapi.yaml
x-openapi-flow apply openapi.yaml
x-openapi-flow validate openapi.yaml --profile strict
```

## References

- Changelog: `CHANGELOG.md`
- AI sidecar guidance: `llm.txt`
- Wiki: `docs/wiki/AI-Sidecar-Authoring.md`
