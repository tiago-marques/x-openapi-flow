# Swagger UI Integration

## Objetivo

Exibir `x-openapi-flow` diretamente no Swagger UI para facilitar leitura de estado por operação.

## Exemplo pronto no repositório

- `flow-spec/examples/swagger-ui/index.html`
- `flow-spec/examples/swagger-ui/x-openapi-flow-plugin.js`

## Como rodar localmente

```bash
cd flow-spec
python3 -m http.server 8080
```

Abra:

`http://localhost:8080/examples/swagger-ui/index.html`

## Como funciona

- `showExtensions: true` mantém extensões visíveis.
- Plugin customizado adiciona um painel no resumo da operação com:
  - `version`
  - `current_state`

## Dica

Depois de regenerar seu OpenAPI, rode `x-openapi-flow apply` antes de abrir no Swagger UI.
