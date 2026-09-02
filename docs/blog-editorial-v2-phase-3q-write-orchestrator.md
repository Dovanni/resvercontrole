# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-Q — Orquestrador Repository-Only de Escrita Editorial

Status: concluída em modo repository-only. Sem escrita Supabase, sem deploy, sem alteração Cloudflare e sem merge em `main`.

## Objetivo

Unificar o pipeline de preparação das futuras escritas editoriais sem permitir execução real.

O orquestrador encadeia:

1. validação do snapshot de referências;
2. geração do contrato de mutação da Fase 3-N;
3. resolução de categoria/autor/tags da Fase 3-P;
4. geração do plano transacional atômico;
5. preservação do optimistic concurrency por `revision_number`;
6. normalização de falhas de catálogo, mutação, transação e execução.

## Implementação

Arquivo principal:

`src/features/blog/editorial-write-orchestrator.ts`

Modo fixo:

`repository_only_disabled`

Todo plano possui:

- `executable: false`;
- snapshot de catálogo com origem e horário de carga;
- mutation envelope;
- transaction plan;
- `readyForFutureExecution` apenas como indicador de prontidão contratual;
- `blockingReasons` preservando a feature flag OFF das fases anteriores.

`readyForFutureExecution = true` não habilita escrita. Significa somente que os contratos, referências e transação estão coerentes para uma fase futura.

## Catálogo de referências

O orquestrador exige um `EditorialReferenceCatalogSnapshot` com:

- categorias;
- autores;
- tags;
- `loadedAt` válido;
- origem declarada (`repository_only_fixture` ou `future_supabase_read`).

Snapshot inválido bloqueia o pipeline com:

`BLOG_EDITORIAL_CATALOG_SNAPSHOT_INVALID`

## Review

`recordReviewDecision` exige decisão explícita (`approved` ou `changes_requested`). A decisão continua separada da mudança de status do post, preservando o contrato four-eyes já homologado.

## Concorrência

Mutações de posts existentes continuam preservando:

`WHERE id = post_id AND revision_number = expected_revision`

Conflito esperado:

`BLOG_EDITORIAL_REVISION_CONFLICT`

Nenhuma escrita concorrente poderá ser tratada futuramente como sucesso silencioso.

## Barreira final

`executeEditorialWriteOrchestration()` sempre lança:

`BLOG_EDITORIAL_ORCHESTRATOR_EXECUTION_DISABLED_REPOSITORY_ONLY`

Nenhum cliente Supabase é importado pelo orquestrador.

## Testes

Arquivo:

`src/features/blog/editorial-write-orchestrator.test.ts`

Cobertura:

- pipeline completo mutation → references → transaction;
- referências não resolvidas;
- optimistic concurrency;
- decisão de review obrigatória;
- decisão de review sem alteração automática de status;
- snapshot de catálogo inválido;
- executor fail-closed;
- normalização de erros de orquestração e RLS.

## Estado preservado

- zero INSERT/UPDATE/DELETE/RPC/upload no Supabase nesta fase;
- zero importação dos três drafts;
- feature flag de escrita permanece OFF;
- executor Supabase permanece fail-closed;
- Cloudflare intacto;
- nenhum deploy;
- `main` intacto.

## Próxima fronteira sugerida

Fase 3-R — Preparação Repository-Only do Read Model Administrativo, projetando lista de drafts/revisões, detalhe editorial, timeline de workflow e catálogo de referências por consultas somente leitura, antes de qualquer conexão de escrita real.
