# Blog Editorial V2 — P.10-C6.SEO-IMPL-R1 — Contrato de persistência

## Escopo

Fase repository-only. Este documento define o contrato que uma futura migration do Blog Lab deverá implementar para persistir controles SEO por artigo. Nenhuma migration desta fase foi aplicada ao Supabase, nenhuma RPC foi alterada em ambiente remoto e nenhum deploy foi executado.

## Estado atual considerado

O Blog Editorial V2 já persiste título SEO, descrição SEO, palavra-chave, imagem e demais dados editoriais pela RPC `public.blog_save_draft_transaction(...)`. O guard `blog_private.guard_blog_post_write()` trata mudanças materiais como novas revisões e a tabela `public.blog_post_revisions` mantém snapshots por revisão.

## Novas colunas propostas em `public.blog_posts`

```sql
seo_allow_indexing boolean not null default true,
seo_allow_following boolean not null default true,
seo_include_in_sitemap boolean not null default true
```

### Compatibilidade

Os três defaults são `true`, preservando o comportamento histórico dos artigos existentes: `index`, `follow` e inclusão no sitemap editorial.

### Invariante de sitemap

O estado persistido deve obedecer:

```text
seo_allow_indexing = false => seo_include_in_sitemap = false
```

A futura migration deve impor essa regra por `CHECK`, normalização na RPC ou ambos. O contrato frontend já normaliza esse caso antes da persistência, mas o banco deve permanecer autoridade final.

## Extensão proposta da RPC `public.blog_save_draft_transaction`

Adicionar exatamente os argumentos:

```sql
p_seo_allow_indexing boolean,
p_seo_allow_following boolean,
p_seo_include_in_sitemap boolean
```

A RPC deverá:

1. normalizar valores nulos para `true` somente por compatibilidade de chamada antiga, se a estratégia de migração exigir coexistência temporária;
2. forçar `seo_include_in_sitemap = false` quando `seo_allow_indexing = false`;
3. gravar os três campos tanto em `create` quanto em `update`;
4. manter `SECURITY INVOKER`, grants e RLS atuais;
5. preservar o revision guard e o erro `BLOG_EDITORIAL_REVISION_CONFLICT`.

## Mudança material / revisão

Os três campos SEO devem entrar na expressão `_content_changed` de `blog_private.guard_blog_post_write()`:

```sql
or new.seo_allow_indexing is distinct from old.seo_allow_indexing
or new.seo_allow_following is distinct from old.seo_allow_following
or new.seo_include_in_sitemap is distinct from old.seo_include_in_sitemap
```

Consequência obrigatória: qualquer alteração de indexação, follow ou sitemap incrementa `revision_number`, limpa aprovação anterior e exige novo fluxo de revisão antes de publicação.

## Snapshot revisional

`blog_private.capture_blog_post_revision()` deverá registrar no `snapshot` de cada nova revisão, no mínimo:

```json
{
  "seo_allow_indexing": true,
  "seo_allow_following": true,
  "seo_include_in_sitemap": true
}
```

Isso garante auditoria histórica do estado SEO aprovado em cada revisão.

## Read-model editorial e público

Após a futura migration:

- `editorial-editor-read-model.ts` deverá selecionar os três campos e colocá-los no formulário editorial;
- `blog.repository.ts` deverá ler os três campos em vez de injetar defaults fixos;
- artigos antigos já migrados continuarão com `true/true/true` por default de banco;
- `blog-seo-policy.ts` continuará sendo a autoridade de resolução para `robots` e sitemap.

## UI futura do editor

Somente depois de a persistência estar validada e aplicada deverão ser habilitados no `/editorial/editor`:

- Permitir indexação;
- Permitir seguir links;
- Incluir no Sitemap XML;
- URL canônica somente leitura;
- prévia informativa do resultado de busca.

Até lá, não devem existir switches aparentemente funcionais que não persistem.

## Estratégia segura de rollout

1. preparar migration e rollback no repositório;
2. validar SQL em laboratório descartável;
3. comprovar defaults em registros existentes;
4. comprovar create/update da RPC;
5. comprovar bump de revisão em SEO-only change;
6. comprovar limpeza de aprovação anterior;
7. comprovar snapshot revisional com os três campos;
8. comprovar `noindex => sitemap=false` no banco;
9. somente então solicitar autorização explícita para aplicação no Blog Lab;
10. depois habilitar read-model e UI editorial.

## Rollback esperado

O rollback deverá restaurar a assinatura anterior da RPC e a versão anterior do guard antes de remover as colunas. A ordem é importante para evitar funções referenciando colunas inexistentes.

Não é permitido apagar `blog_post_revisions` históricas durante rollback. Snapshots já existentes podem conservar as chaves SEO sem impacto.

## Fora de escopo

- robots.txt global;
- Search Console;
- Cloudflare;
- deploy;
- alteração do artigo piloto publicado;
- correção da imagem pública P.10-C6.IMG-FIX;
- aplicação da migration no Supabase.
