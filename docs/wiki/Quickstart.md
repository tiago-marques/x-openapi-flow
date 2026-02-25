# Quickstart

## 1) Instalar

```bash
npm install x-openapi-flow
```

ou direto com `npx`:

```bash
npx x-openapi-flow --help
```

## 2) Inicializar sidecar

Com seu OpenAPI existente:

```bash
npx x-openapi-flow init openapi.yaml
```

Isso cria/sincroniza `x-openapi-flow.flows.yaml`.

## 3) Editar fluxos

Edite o sidecar e preencha os blocos `x-openapi-flow` por operação.

## 4) Reaplicar após regenerar OpenAPI

```bash
npx x-openapi-flow apply openapi.yaml
```

## 5) Validar

```bash
npx x-openapi-flow validate openapi.yaml --profile strict
```

## 6) Visualizar grafo

```bash
npx x-openapi-flow graph openapi.yaml --format mermaid
```

## Exemplos completos

Para cenários reais completos (com OpenAPI válido e múltiplas operações), veja:

- [Exemplos Reais Completos](Real-Examples)
