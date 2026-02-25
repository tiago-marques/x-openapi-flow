# x-openapi-flow Local Example Project

This folder is a local playground to test `x-openapi-flow` directly from the local source (`file:../flow-spec`) with a simple OpenAPI spec and Swagger UI.

## 1) Install

```bash
cd example-project
npm install
```

## 2) Run Swagger UI

```bash
npm start
```

Open:

- http://localhost:3000/docs

## 3) Validate flow with local CLI package

```bash
npm run validate
npm run graph
npm run doctor
```

## Notes

- Dependency `x-openapi-flow` points to `../flow-spec`, so changes in the local library can be reinstalled quickly:

```bash
npm install
```
