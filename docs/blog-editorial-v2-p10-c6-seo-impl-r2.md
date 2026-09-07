# P.10-C6.SEO-IMPL-R2 — Migration SQL + rollback exato

## Escopo

Preparação repository-only da persistência dos controles SEO por artigo. Nenhum SQL desta fase foi aplicado ao Supabase.

## Migration preparada

`supabase/migrations/20260906195800_blog_editorial_v2_seo_controls_persistence.sql`

A migration adiciona a `public.blog_posts`:

- `seo_allow_indexing boolean not null default true`;
- `seo_allow_following boolean not null default true`;
- `seo_include_in_sitemap boolean not null default true`.

Também adiciona a constraint `blog_posts_seo_sitemap_requires_indexing_check`, impedindo `seo_allow_indexing = false` junto com `seo_include_in_sitemap = true`.

## Compatibilidade

Os três defaults preservam o comportamento atual dos artigos existentes: indexação permitida, links seguidos e inclusão no sitemap. A adição das colunas não executa UPDATE nos posts e, portanto, não deve gerar revisão editorial apenas por causa da migration.

## Guard revisional

`blog_private.guard_blog_post_write()` passa a tratar qualquer mudança nos três flags SEO como alteração material. Isso mantém o contrato atual de revisão:

- incremento de `revision_number`;
- limpeza de `reviewed_by`;
- necessidade de nova aprovação para a revisão alterada;
- bloqueio de alteração material direta em conteúdo que permaneça `published`.

A proteção anterior de concorrência para tags por bump explícito de `revision_number` foi preservada.

## Snapshot revisional

Não é necessário alterar `blog_private.capture_blog_post_revision()`: ele já usa `to_jsonb(new)`, portanto qualquer nova revisão criada após a migration captura automaticamente os três flags SEO dentro do snapshot.

## RPC

A assinatura de `public.blog_save_draft_transaction(...)` é substituída por uma versão com três argumentos adicionais:

- `p_seo_allow_indexing boolean`;
- `p_seo_allow_following boolean`;
- `p_seo_include_in_sitemap boolean`.

A função continua `SECURITY INVOKER`, com `EXECUTE` somente para `authenticated`.

A RPC normaliza `noindex` para `sitemap=false` antes da escrita. Valores nulos são tratados como defaults retrocompatíveis `true`.

## Rollback exato

`supabase/rollback/20260906195800_blog_editorial_v2_seo_controls_persistence.rollback.sql`

O rollback:

1. remove a assinatura RPC R2;
2. restaura a assinatura e o corpo anteriores da RPC de drafts;
3. restaura o guard anterior à R2, mantendo a proteção de concorrência de tags;
4. remove a constraint SEO;
5. remove exclusivamente as três colunas SEO adicionadas pela R2.

O rollback não remove revisões históricas. Caso uma migration R2 já tivesse criado novas revisões, seus snapshots JSON continuariam como histórico imutável, mesmo após a remoção das colunas do post atual.

## Limites desta fase

- migration não aplicada;
- rollback não executado;
- nenhum INSERT/UPDATE/DELETE real;
- nenhuma RPC remota alterada;
- nenhum artigo alterado;
- nenhum deploy;
- nenhum merge;
- nenhum auto-merge.

## Próximo gate

`P.10-C6.SEO-IMPL-R2.V` deve validar estaticamente migration/rollback e, preferencialmente, executar apply/rollback apenas em laboratório descartável antes de qualquer autorização para o Blog Lab real.
