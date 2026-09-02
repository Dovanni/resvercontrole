# Blog Editorial V2 — Fase 3-U.1 — RPC Transacional de Drafts

## Escopo

Preparação repository-only da RPC transacional necessária para criação e atualização de drafts com sincronização atômica de tags. Nenhuma migration desta fase foi aplicada ao Supabase.

## Migration preparada

`supabase/migrations/20260902203000_blog_editorial_v2_draft_transaction_rpc.sql`

RPC pública preparada:

`public.blog_save_draft_transaction(...)`

A função é `SECURITY INVOKER`, portanto continua sujeita ao usuário autenticado, aos grants, às RLS e aos triggers editoriais existentes. O `EXECUTE` é revogado de `public` e concedido somente a `authenticated`.

## Operações suportadas

### create

Executa na mesma chamada/transação:

1. valida Auth;
2. valida categoria, autor e tags ativas;
3. cria `blog_posts` obrigatoriamente como `draft`;
4. deixa `created_by`, `updated_by` e revisão inicial sob autoridade do trigger;
5. cria todas as associações em `blog_post_tags`;
6. retorna `post_id`, `revision_number` e `status`.

Qualquer erro aborta a chamada completa.

### update

Executa na mesma chamada/transação:

1. bloqueia a linha do post com `FOR UPDATE`;
2. exige status atual `draft`;
3. compara `revision_number` com `p_expected_revision`;
4. valida referências canônicas ativas;
5. compara tags atuais e desejadas;
6. atualiza o draft usando o revision guard;
7. substitui tags apenas quando o conjunto mudou;
8. retorna o novo estado.

Conflito de revisão produz `BLOG_EDITORIAL_REVISION_CONFLICT` com SQLSTATE `40001`.

## Correção de concorrência para tags

A auditoria da 3-U.1 detectou que o guard original incrementava `revision_number` para mudanças de conteúdo do post, mas tags residem em `blog_post_tags` e, isoladamente, não provocavam bump de revisão.

A migration ajusta `blog_private.guard_blog_post_write()` para considerar uma alteração explícita de `revision_number` como sinal de mudança material. A RPC usa esse sinal somente quando o conjunto de tags muda. O guard continua controlando o valor final (`old.revision_number + 1`) e limpa aprovação anterior.

Resultado: duas edições concorrentes, inclusive tags-only, passam a compartilhar a mesma proteção otimista.

## Adaptador frontend repository-only

Criado `src/features/blog/editorial-draft-rpc.adapter.ts`.

Ele converte o plano de `createDraft`/`updateDraft` já resolvido nas fases anteriores para os argumentos exatos da futura RPC:

- UUID de categoria;
- UUID de autor;
- UUIDs de tags;
- conteúdo e SEO;
- `post_id` e `expected_revision` no update.

O adaptador permanece:

`mode = repository_only_disabled`

`executable = false`

`executeEditorialDraftRpc()` falha propositalmente com `BLOG_EDITORIAL_DRAFT_RPC_NOT_APPLIED_OR_ENABLED`.

## Rollback preparado

`supabase/rollback/20260902203000_blog_editorial_v2_draft_transaction_rpc.rollback.sql`

O rollback remove a RPC e restaura o guard ao contrato anterior à 3-U.1.

## Limites preservados

- migration NÃO aplicada no staging;
- zero INSERT real;
- zero UPDATE real;
- zero DELETE real;
- zero RPC real;
- zero importação dos três drafts;
- zero publicação;
- Cloudflare intacto;
- deploy inexistente;
- `main` intacto.

## Próximo passo seguro

Antes da Fase 3-V, esta migration deverá passar por uma **validação executável controlada** (preferencialmente no laboratório descartável, recriando o schema Blog se necessário) para comprovar create/update, rollback atômico, RLS por papel, tags-only revision bump e conflito concorrente. Somente depois deverá existir autorização específica para aplicação no `vejamais-erp-staging`.
