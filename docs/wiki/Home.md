# x-openapi-flow Wiki

`x-openapi-flow` é uma CLI para validar e manter fluxos de ciclo de vida de recursos em OpenAPI usando a extensão vendor `x-openapi-flow`.

## O que o projeto resolve

APIs reais mudam com frequência, e o fluxo de estados costuma ficar implícito.
Com `x-openapi-flow`, o estado atual e as transições ficam explícitos por operação, com validação automática.

## Principais capacidades

- Validação de schema da extensão `x-openapi-flow`
- Validação de consistência de grafo (órfãos, alcançabilidade, ciclos, estados terminais)
- Perfis de validação (`core`, `relaxed`, `strict`)
- Sidecar para persistir fluxos em OpenAPI regenerado (`init` + `apply`)
- Export de grafo (`mermaid`/`json`)
- Exemplo de integração com Swagger UI

## Começo rápido

```bash
npm install x-openapi-flow
npx x-openapi-flow init openapi.yaml
npx x-openapi-flow validate openapi.yaml --profile strict
```

## Páginas desta Wiki

- [Quickstart](Quickstart)
- [CLI Reference](CLI-Reference)
- [Flow Model](Flow-Model)
- [Exemplos Reais Completos](Real-Examples)
- [Swagger-UI Integration](Swagger-UI-Integration)
- [FAQ](FAQ)
