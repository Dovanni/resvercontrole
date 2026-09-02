# Blog Editorial V2 — Fase 3-S — Integração Repository-Only do Read Model com o Painel

## Objetivo

Integrar o read model administrativo criado na Fase 3-R à rota protegida `/editorial`, mantendo o frontend estritamente em modo de leitura e sem habilitar qualquer mutação real.

## Painel integrado

A rota `/editorial` passou a consumir `loadEditorialAdministrativeReadModel()` e `getEditorialPostReadModel(postId)`.

A interface agora oferece:

- resumo de artigos, categorias, tags e autores;
- filtros por status `draft`, `review`, `scheduled`, `published` e `archived`;
- listagem administrativa com slug, revisão, categoria e atualização;
- detalhe do artigo selecionado;
- timeline de `blog_workflow_events`;
- decisões de `blog_post_reviews`;
- snapshots/versionamento de `blog_post_revisions`;
- catálogo de categorias, autores e tags;
- contexto do membership editorial atual.

## Segurança preservada

- `/editorial` permanece `noindex, nofollow, noarchive`.
- sessão Auth e membership editorial ativo continuam obrigatórios;
- RLS continua autoridade definitiva;
- papéis operacionais do ERP não concedem acesso editorial;
- a UI desta fase não contém INSERT, UPDATE, DELETE, RPC, upload ou publicação;
- a feature flag e os executores fail-closed das Fases 3-O a 3-Q permanecem intocados.

## Estado vazio esperado

Os três artigos homologados continuam apenas no repositório local. Como ainda não houve importação para `blog_posts`, a lista administrativa pode permanecer vazia no staging até uma fase posterior explicitamente autorizada.

## Limites

- zero migrations;
- zero mutações no Supabase;
- zero importação de drafts;
- zero publicação;
- zero deploy;
- Cloudflare intacto;
- `main` intacto.

## Próxima fronteira

Após homologação visual/funcional do painel read-only, uma fase posterior poderá preparar a ligação do protótipo `/editorial/editor` ao read model real para carregar um draft existente, ainda mantendo persistência desabilitada até autorização específica.
