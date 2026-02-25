# x-openapi-flow Local Example Project

This folder is a local playground to test `x-openapi-flow` directly from the local source (`file:../flow-spec`) with a simple OpenAPI spec and Swagger UI.

## Overview

This example project is intended for local development and manual validation of:

- OpenAPI flow validation
- Mermaid graph generation
- Swagger UI rendering with `x-openapi-flow`

## Setup

### 1) Install dependencies

```bash
cd example-project
npm install
```

### 2) Start Swagger UI

```bash
npm start
```

Open:

- http://localhost:3000/docs

### 3) Run validation commands

```bash
npm run validate
npm run graph
npm run doctor
```

## Development Notes

- Dependency `x-openapi-flow` points to `../flow-spec`.
- After making changes in the local CLI package, reinstall dependencies in this project to refresh the local link:

```bash
npm install
```
