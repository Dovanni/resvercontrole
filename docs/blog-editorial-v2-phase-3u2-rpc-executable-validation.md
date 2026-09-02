# Blog Editorial V2 — Fase 3-U.2 — Validação Executável da RPC

## Ambiente

Validação executada exclusivamente no projeto descartável `vejamais-blog-lab`.
O `vejamais-erp-staging` permaneceu fora de qualquer alteração.

Para evitar recriar Storage sem necessidade, foi usado um harness de laboratório com as tabelas, triggers, RLS e contratos de workflow necessários à RPC. O bucket `blog-media` não foi recriado.

## RPC validada

`public.blog_save_draft_transaction(...)`

- `SECURITY INVOKER`;
- sessão Auth obrigatória;
- referências canônicas de categoria/autor/tags;
- `create` atômico de post + tags;
- `update` com `SELECT ... FOR UPDATE`;
- guarda otimista por `expected_revision`;
- sincronização atômica de tags;
- rollback automático em erro.

## Defeito encontrado no laboratório

O primeiro teste de alteração somente de tags encontrou:

`42702: column reference "post_id" is ambiguous`

A causa foi a colisão entre o OUT parameter `post_id` de `RETURNS TABLE` e a coluna não qualificada no `DELETE` de `blog_post_tags`.

A falha confirmou atomicidade: o post permaneceu na revisão #2 e as tags antigas permaneceram intactas; nenhuma alteração parcial persistiu.

## Correção repository-only

Foi adicionada a migration:

`supabase/migrations/20260902203100_blog_editorial_v2_draft_rpc_qualification_fix.sql`

Correção:

`delete from public.blog_post_tags pt where pt.post_id = p_post_id;`

Nenhuma alteração foi aplicada ao staging.

## Evidências executáveis após a correção

1. `create` como owner: sucesso, `revision_number = 1`, `status = draft`.
2. atualização de conteúdo: sucesso, revisão #1 → #2.
3. alteração somente de tags: sucesso, revisão #2 → #3.
4. tentativa obsoleta usando revisão #2 após revisão #3: bloqueada com `BLOG_EDITORIAL_REVISION_CONFLICT`, SQLSTATE `40001`.
5. usuário ERP comum sem membership editorial: bloqueado por `BLOG_EDITORIAL_WRITE_FORBIDDEN`.
6. self-review do criador da revisão: bloqueado por `BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN`.
7. reviewer independente: aprovação aceita para a revisão corrente.
8. estado de prova antes do rollback: 1 post, 2 tags vinculadas, 3 snapshots de revisão, 1 review e 2 eventos de workflow.

## Rollback do laboratório

Após os testes, todo o harness foi removido.

Estado final confirmado:

- `blog_private`: ausente;
- `blog_save_draft_transaction`: ausente;
- tabelas `blog_*`: 0;
- `blog-media`: ausente;
- `public.set_updated_at()`: preservada.

## Conclusão

A RPC foi validada executavelmente após a correção de qualificação. A validação demonstrou atomicidade, concorrência otimista, tags-only revision bump, isolamento de usuários comuns e princípio four-eyes.

Antes de qualquer aplicação no staging, recomenda-se uma fase repository-only de consolidação para incorporar a correção diretamente à migration canônica da RPC e evitar manter uma migration corretiva separada desnecessariamente.
