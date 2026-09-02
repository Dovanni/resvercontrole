# VEJAMAIS ERP — Fase 3-I

## Revisão da migration repository-only

Arquivo preparado: `supabase/migrations/20260902143100_blog_editorial_v2_schema.sql`.

Status: **NÃO APLICADO AO SUPABASE**.

Esta migration foi desenhada exclusivamente para revisão técnica antes de qualquer autorização de execução.

## Escopo criado pela migration, caso futuramente aplicada

- schema privado `blog_private` para helpers de autorização e triggers;
- `blog_categories`;
- `blog_tags`;
- `blog_authors`;
- `blog_editorial_members`;
- `blog_posts`;
- `blog_post_tags`;
- `blog_post_revisions`;
- `blog_workflow_events`;
- `blog_post_reviews`;
- índices, constraints, triggers, RLS e grants mínimos;
- bucket público `blog-media` com upload/update/delete protegido por RLS;
- taxonomia editorial inicial e autor institucional `Equipe Editorial VEJAMAIS ERP`.

## Decisões de isolamento

1. Nenhuma tabela editorial possui `empresa_id`.
2. Nenhuma FK editorial aponta para `empresas`, `subscriptions`, financeiro, estoque, vendas ou billing.
3. O enum operacional `public.app_role` não é alterado.
4. `user_roles` e `user_company_access` não são alterados.
5. Papéis editoriais ficam em `blog_editorial_members`: `owner`, `editor`, `author`, `reviewer`.
6. O primeiro `owner` editorial não é criado nesta migration; bootstrap deverá ser uma ação posterior, explícita e auditada.
7. Os três drafts locais não são importados nesta migration.
8. Não é criado cron/job de publicação automática.

## Contrato público

A role `anon` recebe apenas SELECT em categorias/tags/autores ativos, posts publicados e suas relações de tags. A policy de `blog_posts` exige simultaneamente:

- `status = 'published'`;
- `published_at IS NOT NULL`;
- `published_at <= now()`.

Drafts, revisão, agendados e arquivados permanecem invisíveis ao público.

## Contrato editorial

- `owner` e `editor`: administração editorial e transições de workflow;
- `author`: cria e edita apenas o próprio draft e pode enviá-lo para revisão;
- `reviewer`: leitura editorial e registro de parecer em `blog_post_reviews`;
- DELETE de posts não é concedido pela Data API; retirada editorial ocorre por `archived`.

## Workflow transacional

Transições aceitas pelo guard:

- `draft -> review` (owner/editor/autor do próprio draft);
- `draft -> archived` (owner/editor);
- `review -> draft|scheduled|published|archived` (owner/editor);
- `scheduled -> review|published|archived` (owner/editor);
- `published -> review|archived` (owner/editor);
- `archived -> draft` (owner/editor).

Conteúdo publicado não pode ser alterado mantendo `status='published'`; deve retornar a revisão antes de mudanças editoriais materiais.

## Versionamento e auditoria

Cada INSERT/UPDATE de `blog_posts` gera snapshot em `blog_post_revisions`. Mudanças de status geram eventos imutáveis em `blog_workflow_events`.

## Storage

`blog-media` foi desenhado como bucket público para permitir URLs permanentes de imagem para SEO/Open Graph. Ele aceita apenas JPEG, PNG, WebP e AVIF, com limite de 5 MiB. Escrita continua restrita aos membros editoriais autorizados. Portanto nenhum conteúdo sensível deverá ser armazenado nesse bucket.

## Pendências antes de autorização de aplicação

1. validar sintaxe da migration em banco descartável/dev branch;
2. validar RLS usando usuários representativos de `anon`, usuário ERP comum, author, reviewer, editor e owner;
3. confirmar estratégia do primeiro owner editorial;
4. confirmar se `blog-media` deve permanecer público ou se haverá fluxo privado->público;
5. verificar advisors de segurança/performance após aplicação em ambiente descartável;
6. revisar rollback e ordem de remoção;
7. somente depois considerar aplicação no projeto staging.
