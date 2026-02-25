# FAQ

## O projeto substitui OpenAPI?

Não. Ele estende OpenAPI com `x-openapi-flow`.

## Preciso editar o OpenAPI gerado manualmente?

Não. Use sidecar (`init`/`apply`) para manter os fluxos separados e reaplicáveis.

## Funciona com arquivos JSON e YAML?

Sim, ambos.

## O Swagger UI valida os fluxos?

Não. O Swagger UI apenas exibe. A validação é feita pela CLI (`validate`).

## Tenho OpenAPI legado com `x-flow`. E agora?

Migre para `x-openapi-flow` para compatibilidade com as versões atuais.

## Posso usar em CI?

Sim. Rode `x-openapi-flow validate ... --profile strict --strict-quality` no pipeline.
