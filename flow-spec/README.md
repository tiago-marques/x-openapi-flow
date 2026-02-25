# x-openapi-flow

CLI and specification for validating the `x-flow` extension field in OpenAPI documents.

## Installation

```bash
npm install x-openapi-flow
```

## Quick Usage

```bash
x-openapi-flow validate openapi.yaml
x-openapi-flow graph openapi.yaml
x-openapi-flow doctor
```

## Commands

```bash
x-openapi-flow validate <openapi-file> [--format pretty|json] [--profile core|relaxed|strict] [--strict-quality] [--config path]
x-openapi-flow init [output-file] [--title "My API"]
x-openapi-flow graph <openapi-file> [--format mermaid|json]
x-openapi-flow doctor [--config path]
```

## Optional Configuration

Create `x-openapi-flow.config.json` in your project directory:

```json
{
  "profile": "strict",
  "format": "pretty",
  "strictQuality": false
}
```

## File Compatibility

- OpenAPI input in `.yaml`, `.yml`, and `.json`
- Validation processes OAS content with the `x-flow` extension

## Repository and Full Documentation

- Repository: https://github.com/tiago-marques/x-openapi-flow
- Full guide and changelog are available in the root repository.
