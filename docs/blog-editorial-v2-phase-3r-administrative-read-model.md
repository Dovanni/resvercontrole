# Blog Editorial V2 — Fase 3-R — Read Model Administrativo Repository-Only

## Escopo

Fase dedicada à camada de leitura administrativa do Blog Editorial V2. Nenhuma escrita, migration, deploy ou alteração Cloudflare faz parte desta etapa.

## Implementação

Criado `src/features/blog/editorial-read-model.ts` com quatro fronteiras de leitura:

1. `requireEditorialReadAccess()` — exige sessão Auth e membership editorial ativo.
2. `loadEditorialReferenceCatalog()` — carrega categorias, autores e tags no mesmo contrato canônico usado pelo resolver da Fase 3-P.
3. `listEditorialPosts()` — lista posts administrativos com status, revisão, categoria, autor e datas operacionais.
4. `getEditorialPostReadModel(postId)` — carrega, em modo somente leitura, revisões, decisões de review e timeline de workflow de um artigo.

`loadEditorialAdministrativeReadModel()` compõe membership, posts e catálogo em um snapshot administrativo marcado explicitamente como `mode: read_only`.

## Segurança

- O read model não contém INSERT, UPDATE, DELETE, RPC ou upload.
- A sessão é validada antes das consultas administrativas.
- `blog_editorial_members.active = true` é obrigatório.
- As RLS do banco continuam sendo a autoridade final.
- Papéis do ERP não são convertidos em membership editorial.
- A camada de leitura não altera a feature flag de escrita das Fases 3-O/3-P/3-Q.

## Timeline editorial

O detalhe administrativo reúne três fontes separadas:

- `blog_post_revisions`: snapshots/versionamento;
- `blog_post_reviews`: decisões `approved` / `changes_requested`;
- `blog_workflow_events`: mudanças de estado e ator.

Essa separação preserva o contrato four-eyes e evita interpretar decisão de review como transição automática de status.

## Catálogo canônico

Categorias/tags são convertidas para `{ id, slug, name, active }`; autores para `{ id, slug, displayName, active }`. Portanto o read model já entrega exatamente o catálogo esperado pelo resolvedor repository-only da Fase 3-P e pelo orquestrador da Fase 3-Q.

## Testes

Criado `src/features/blog/editorial-read-model.test.ts` cobrindo mapeamento de posts administrativos, referências canônicas, autores e relações ausentes.

## Limites preservados

- zero mutações no Supabase;
- zero migrations;
- zero importação dos três drafts homologados;
- zero publicação;
- zero deploy;
- Cloudflare intacto;
- `main` intacto.

## Próxima fronteira

Uma fase posterior poderá integrar esse read model à UI administrativa (`/editorial`) para listagem de posts, filtros e detalhe/timeline, ainda mantendo os comandos de escrita desabilitados até autorização específica.
