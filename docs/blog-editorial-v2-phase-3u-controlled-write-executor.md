# Blog Editorial V2 — Fase 3-U — Executor de Escrita Controlado

## Objetivo

Preparar a fronteira real de escrita contra o cliente Supabase sem habilitar mutações operacionais no staging.

## Estado operacional

`EDITORIAL_CONTROLLED_WRITES_ENABLED = false`

A flag é hard-coded e não depende de variável de ambiente. Qualquer ativação futura exige mudança explícita de código, revisão e nova autorização.

## Executor conectado

Criado `src/features/blog/editorial-controlled-write.executor.ts`.

O módulo importa o cliente Supabase real, mas verifica a flag OFF antes de construir qualquer query. Assim a integração de tipos/contratos é real, enquanto a execução permanece fail-closed.

## Classificação de segurança

- `single_statement`: mutações que futuramente podem ser executadas como uma única statement, por exemplo decisão de review ou transição otimista de status.
- `requires_atomic_rpc`: operações com múltiplos passos, especialmente criação/edição de draft com sincronização de tags.
- `blocked_plan`: plano já rejeitado pelos contratos anteriores.

## Atomicidade

A Fase 3-P exige que atualização de post e sincronização de tags sejam atômicas. Chamadas independentes do browser não formam uma transação única. Portanto o executor recusa planos multi-step com `BLOG_EDITORIAL_ATOMIC_RPC_REQUIRED` até existir uma RPC transacional específica no banco.

## Concorrência

Updates de posts existentes usam `id + revision_number` e exigem exatamente uma linha afetada. Zero linhas são normalizadas como `BLOG_EDITORIAL_REVISION_CONFLICT`, marcado como retryable após recarregar a revisão atual.

## Segurança preservada

- zero INSERT real;
- zero UPDATE real;
- zero DELETE real;
- zero RPC;
- zero importação dos três drafts;
- zero publicação;
- nenhuma migration;
- Cloudflare e deploy intactos.

## Próximo passo

Antes da importação controlada dos drafts, deve ser desenhada e validada uma RPC transacional mínima para `createDraft/updateDraft + tags`, inicialmente repository-only e testada em laboratório/staging sob autorização específica. A flag de escrita permanece OFF até essa validação.
