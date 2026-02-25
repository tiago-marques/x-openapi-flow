# x-openapi-flow — V2 Development Plan

## Objetivo
Evoluir a lib com foco em adoção real, previsibilidade no workflow sidecar-first e UX melhor no Swagger UI, executando em passos pequenos e verificáveis.

## Princípios de execução
- Entregas pequenas (1 tema por vez).
- Sempre com teste + doc + changelog por etapa.
- Evitar breaking changes sem flag/compatibilidade.
- Só avançar para a próxima etapa após DoD da atual.

## Escopo V2 (priorizado)

### P0 — Base e confiabilidade
1. Cobertura de todos os métodos HTTP OAS3 (`get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`) em `init`/`apply`/`graph`.
2. UX CLI em modo não interativo (`init --force`) consolidada e bem documentada.
3. Feedback de navegação no plugin (jump + highlight), mantendo comportamento resiliente.

### P1 — Ergonomia de uso
4. `--dry-run` no `init` (mostrar mudanças sem gravar arquivo).
5. Diff de sidecar (o que mudaria no `.x` e no `.flow`).
6. Mensagens de erro/aviso mais acionáveis (links/comandos sugeridos).

### P2 — Qualidade avançada
7. Lint semântico (`x-openapi-flow lint`) com regras configuráveis.
8. Export estável de grafo em JSON para CI/observabilidade.
9. Guia de adoção para times (playbook de CI + exemplos por domínio).

---

## Roadmap passo a passo

## Step 1 — HTTP Methods Full Coverage (P0)
**Meta**
Garantir suporte completo a todos os métodos OAS3 no pipeline inteiro.

**Implementação**
- Adicionar testes table-driven para todos os métodos no CLI.
- Validar extração de operações sem `operationId` (fallback) para todos os métodos.
- Validar `apply` e `graph` com sidecar de múltiplos métodos.

**Definition of Done**
- `test:cli` verde com novos cenários.
- Docs citando suporte completo OAS3 methods.

**Status**
- [x] Completed

---

## Step 2 — Harden do workflow init/apply (P0)
**Meta**
Fluxo previsível para ambiente interativo e CI.

**Implementação**
- Revisar mensagens e caminhos de backup.
- Garantir ordem do `--force`: sem prompt -> backup `.x` -> recria `.flow`.
- Validar comportamento em cenários com arquivos existentes/ausentes.

**Definition of Done**
- Testes de regressão cobrindo todos os cenários de recriação.
- Wiki/README alinhados (sem inconsistência de flags).

**Status**
- [x] Completed

---

## Step 3 — Plugin UX polish (P0)
**Meta**
Navegação clara e visual consistente no Swagger UI.

**Implementação**
- Ajustes visuais finais de links `next/requires`.
- Confirmar comportamento de jump (com e sem seções colapsadas) conforme decisão de produto.
- Manter highlight discreto e acessível.

**Definition of Done**
- `test:ui` verde.
- Demonstração funcional no `example-project` (`/docs`).

**Status**
- [ ] In progress

---

## Step 4 — init --dry-run (P1)
**Meta**
Permitir inspeção das mudanças antes de gravar sidecar/output.

**Implementação**
- `x-openapi-flow init --dry-run`.
- Exibir resumo: operações novas, removidas, alteradas.
- Sem escrita em disco quando `--dry-run` estiver ativo.

**Definition of Done**
- Teste CLI cobrindo `--dry-run`.
- Documentação com exemplos.

**Status**
- [x] Completed

---

## Step 5 — Sidecar Diff (P1)
**Meta**
Tornar alterações auditáveis para revisão/PR.

**Implementação**
- Comando novo (proposta): `x-openapi-flow diff [openapi-file] [--flows path]`.
- Saída human-friendly e JSON opcional.
- Comparar estado atual vs estado derivado.

**Definition of Done**
- CLI test + snapshots de saída.
- Guia de uso em CI.

**Status**
- [x] Completed

---

## Step 6 — Lint semântico (P2)
**Meta**
Elevar qualidade de modelagem de fluxo além do schema.

**Implementação (MVP)**
- Comando: `x-openapi-flow lint`.
- Regras iniciais:
  - `next_operation_id` deve existir.
  - `prerequisite_operation_ids` devem existir.
  - transições duplicadas.
  - estados sem caminho para terminal.
- Permitir `--config` para enable/disable regras.

**Definition of Done**
- Regras documentadas.
- Saída consistente (pretty/json).

**Status**
- [x] Completed

---

## Step 7 — Graph JSON export estável (P2)
**Meta**
Facilitar integração com pipelines e observabilidade.

**Implementação**
- Revisar formato JSON atual do `graph` para estabilidade de contrato.
- Garantir ordenação determinística.
- Versionar formato de saída se necessário.

**Definition of Done**
- Testes de snapshot estáveis.
- Documentação de contrato JSON.

**Status**
- [x] Completed

---

## Step 8 — Adoção e docs finais (P2)
**Meta**
Facilitar rollout em times/projetos novos.

**Implementação**
- Playbook de adoção (local + CI + PR checks).
- Exemplos por domínio (orders/payments/refunds).
- Seção de troubleshooting consolidada.

**Definition of Done**
- Wiki e READMEs consistentes.
- Checklist de release atualizado.

**Status**
- [x] Completed

---

## Estratégia de execução (como vamos trabalhar)
Para cada step:
1. Definir mini-escopo (1-3 PRs pequenos).
2. Implementar código.
3. Rodar testes relevantes (`test:cli`, `test:ui`, smoke no exemplo).
4. Atualizar docs.
5. Registrar no changelog.
6. Só então seguir para o próximo step.

## Métricas de sucesso V2
- Redução de dúvidas de uso no `init/apply`.
- Zero regressão em `test:cli`/`test:ui`.
- Cobertura explícita de todos métodos OAS3.
- Menos esforço manual para revisão de mudanças (`diff`/`dry-run`).

## Próximo passo recomendado
Começar pelo **Step 1 (HTTP Methods Full Coverage)** e abrir PR focado apenas em testes + pequenos ajustes de parser/aplicação se necessário.
