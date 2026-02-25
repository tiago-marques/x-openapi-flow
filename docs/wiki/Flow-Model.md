# Flow Model (`x-openapi-flow`)

Cada operação pode ter um bloco:

```yaml
x-openapi-flow:
  version: "1.0"
  id: create-order-flow
  current_state: CREATED
  transitions:
    - target_state: CONFIRMED
      trigger_type: synchronous
```

## Campos principais

- `version`: versão do contrato (atual: `1.0`)
- `id`: identificador único do passo
- `current_state`: estado representado pela operação
- `transitions[]`: transições possíveis a partir do estado atual

## Regras validadas (resumo)

- Schema obrigatório
- Estados órfãos
- Estado inicial e terminal
- Estados inalcançáveis
- Ciclos
- Duplicidade de transição
- Estados sem caminho para terminal

## Perfis

- `core`: schema + órfãos
- `relaxed`: checks avançados como warnings
- `strict`: checks avançados como erro
