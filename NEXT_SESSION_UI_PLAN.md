# Próxima Sessão — Plano de Melhorias de UI

## Contexto Atual (status rápido)

- Release `v1.2.3` publicada (GitHub + npm).
- Fluxo padrão consolidado com 3 arquivos:
  - `swagger.json` (base)
   - `swagger.x.json` (sidecar)
  - `swagger.flow.json` (saída aplicada)
- Plugin Swagger UI movido para caminho canônico:
  - `flow-spec/lib/swagger-ui/x-openapi-flow-plugin.js`
- Plugin já está com guard para não aplicar UI quando não houver `x-openapi-flow` no spec.

---

## Objetivo da próxima sessão

Elevar a UX da visualização no Swagger UI sem aumentar complexidade desnecessária, mantendo o fluxo sidecar-first simples e previsível.

---

## Backlog Prioritário (UI)

## P0 — Qualidade percebida (foco inicial)

1. **Refinar layout dos cards de operação**
   - Melhorar espaçamento, hierarquia visual e legibilidade em dark/light mode.
   - Garantir consistência entre blocos “Transitions”, “Graph” e metadata.

2. **Melhorar UX do Overview global**
   - Ajustar posição/âncora do bloco no topo para não conflitar com outras extensões.
   - Evitar render redundante em specs grandes (throttle + hash mais robusto).

3. **Estados de erro e fallback mais claros**
   - Quando Mermaid não carregar: mostrar mensagem curta + ação sugerida.
   - Quando não houver dados de flow: exibir estado neutro e discreto (sem poluir UI).

## P1 — Usabilidade avançada

4. **Navegação cruzada por operação**
   - A partir do `next_operation_id`, permitir jump para operação correspondente no Swagger UI.

5. **Controles de visualização (mínimos)**
   - Toggle simples para recolher/expandir o card `x-openapi-flow` por operação.

6. **Compatibilidade com specs maiores**
   - Revisar custo de MutationObserver e reduzir reprocessamento de DOM.

## P2 — Robustez e adoção

7. **Testes para plugin (ainda faltam)**
   - Hoje os testes são CLI-only.
   - Adicionar cobertura mínima para:
     - spec sem `x-openapi-flow` (plugin no-op)
     - spec com flows (render esperado)
     - fallback quando Mermaid falha.

8. **Exemplo visual adicional**
   - Criar um exemplo com mais estados/transições para stress visual.

---

## Pontos que ainda faltam (observações técnicas)

1. **Cobertura de teste para UI**
   - Principal gap atual: não há teste automatizado do plugin em navegador.

2. **Política de manutenção de docs históricos**
   - Alguns release notes antigos mantêm caminhos anteriores do plugin (ok historicamente, mas pode confundir).
   - Decidir se mantemos histórico literal ou adicionamos nota de “path atual”.

3. **Proteção de `example-project/swagger.json` via hash no CI**
   - Funciona bem para evitar mudanças acidentais.
   - Quando quisermos evoluir o arquivo base, será necessário atualizar hash de forma explícita.

4. **Script utilitário opcional para DX**
   - Avaliar adicionar (no exemplo) um comando tipo `start:base` para abrir UI forçando `swagger.json`.

---

## Plano sugerido para executar na próxima sessão (90–120 min)

1. **Sprint 1 (30–40 min)**
   - Ajustes visuais dos cards + overview.

2. **Sprint 2 (30–40 min)**
   - Navegação por `next_operation_id` + melhorias de fallback/erros.

3. **Sprint 3 (30–40 min)**
   - Teste mínimo de plugin + atualização pontual de docs de integração.

---

## Critérios de pronto

- UI não muda quando o spec não contém `x-openapi-flow`.
- Cards continuam rápidos em specs médios (sem flicker perceptível).
- Overview renderiza de forma estável e com fallback amigável.
- Pelo menos 1 teste automatizado cobre comportamento básico do plugin.

---

## Comandos úteis para retomada

```bash
cd /workspaces/x-flow/flow-spec
npm test

cd /workspaces/x-flow/example-project
npm install
npm run apply
npm start
```

Abrir:
- `http://localhost:3000/docs`
