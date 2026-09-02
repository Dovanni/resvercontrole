# VEJAMAIS ERP — Fase 3-I.2

## Consolidação final repository-only da migration editorial

Migration canônica preparada:

`supabase/migrations/20260902143100_blog_editorial_v2_schema.sql`

Artefatos manuais auxiliares:

- `supabase/rollback/20260902143100_blog_editorial_v2_schema.rollback.sql`
- `supabase/manual/blog_editorial_v2_bootstrap_owner.sql`

Status: **NÃO APLICADO AO SUPABASE**.

A antiga migration complementar `20260902143200_blog_editorial_v2_schema_hardening.sql` foi removida antes de qualquer aplicação. Todo o hardening agora faz parte da única migration canônica, evitando estado intermediário menos protegido.

## Escopo da migration canônica

Caso futuramente autorizada, a migration cria:

- schema privado `blog_private`;
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
- bucket público `blog-media` com escrita protegida por RLS;
- taxonomia editorial inicial;
- autor institucional `Equipe Editorial VEJAMAIS ERP`.

## Isolamento da matriz

1. Nenhuma tabela editorial possui `empresa_id`.
2. Nenhuma FK editorial aponta para `empresas`, `subscriptions`, billing, financeiro, vendas, estoque ou compras.
3. `public.app_role` não é alterado.
4. `user_roles` não é alterado.
5. `user_company_access` não é alterado.
6. `public.set_updated_at()` é apenas reutilizada e nunca removida pelo rollback.
7. Papéis editoriais permanecem independentes: `owner`, `editor`, `author`, `reviewer`.

## Versionamento sem MAX()+1

`blog_posts` possui `revision_number` próprio.

- INSERT nasce como revisão 1;
- alteração editorial material incrementa `revision_number` dentro do mesmo UPDATE do post;
- mudanças apenas de workflow não incrementam revisão;
- `blog_post_revisions` grava snapshot somente na criação ou quando a revisão muda;
- a constraint `unique(post_id, revision_number)` preserva unicidade.

Essa estratégia remove a antiga condição de corrida de `max(revision_number) + 1`, porque atualizações concorrentes do mesmo post são serializadas pelo lock de linha do próprio UPDATE.

## Four-eyes obrigatório

Cada parecer em `blog_post_reviews` é associado à revisão corrente do post. O trigger de revisão:

1. exige `status='review'`;
2. sobrescreve `reviewer_user_id` com `auth.uid()`;
3. sobrescreve `revision_number` com a revisão corrente;
4. recusa parecer do mesmo usuário que criou a revisão atual.

Para `review -> scheduled` ou `review -> published`, o guard exige que o parecer mais recente da revisão corrente seja `approved`. `reviewed_by` é preenchido a partir desse parecer válido.

Qualquer edição material posterior cria nova revisão e invalida automaticamente aprovações da revisão anterior.

## Workflow consolidado

- `draft -> review`: owner/editor ou autor do próprio draft;
- `draft -> archived`: owner/editor;
- `review -> draft|archived`: owner/editor;
- `review -> scheduled|published`: owner/editor + aprovação four-eyes da revisão corrente;
- `scheduled -> review|archived`: owner/editor;
- `scheduled -> published`: owner/editor, somente quando `now() >= scheduled_at` e com aprovação válida da revisão corrente;
- `published -> review|archived`: owner/editor;
- `archived -> draft`: owner/editor.

Conteúdo material não pode ser alterado permanecendo em `published`. Tags de post publicado também ficam protegidas porque `can_edit_post()` rejeita escrita quando o post está publicado.

## Contrato público

A role `anon` recebe somente SELECT em categorias/tags/autores ativos, posts publicados e relações de tags dos posts públicos. Um post somente é público quando:

- `status = 'published'`;
- `published_at IS NOT NULL`;
- `published_at <= now()`.

Usuários autenticados comuns do ERP não recebem privilégios editoriais por estarem autenticados.

## Bootstrap do primeiro owner

A migration não cria nenhum owner automaticamente.

O script manual `supabase/manual/blog_editorial_v2_bootstrap_owner.sql`:

- exige substituição explícita do e-mail placeholder;
- resolve o UUID em `auth.users`;
- exige exatamente um usuário correspondente;
- falha se já existir owner ativo;
- cadastra somente o primeiro owner.

Esse script exige autorização independente e não deve ser executado junto da migration.

## Rollback conservador

O rollback fica fora da pasta de migrations para impedir execução automática.

Antes de remover o bucket, ele verifica se `blog-media` está vazio. Se houver objetos, aborta. Arquivos devem ser removidos previamente pela Storage API para não deixar blobs órfãos.

Depois remove, nesta ordem:

1. policies de Storage do Blog;
2. bucket vazio `blog-media`;
3. tabelas filhas e tabelas-pai editoriais;
4. funções exclusivas de `blog_private`;
5. schema `blog_private`.

Não remove `public.set_updated_at()` nem qualquer objeto da matriz.

## Matriz de validação obrigatória antes de staging

| Cenário | Resultado esperado |
| --- | --- |
| anon lê draft | negado |
| anon lê published futuro | negado |
| anon lê published vigente | permitido |
| usuário ERP comum cria draft | negado |
| author cria próprio draft com próprio author_id | permitido |
| author usa author_id de terceiro | negado |
| author edita draft de terceiro | negado |
| author envia próprio draft para review | permitido |
| criador da revisão tenta aprová-la | negado |
| reviewer diferente aprova revisão corrente | permitido |
| editor publica sem aprovação | negado |
| editor publica com `changes_requested` como parecer mais recente | negado |
| editor publica revisão aprovada | permitido |
| conteúdo muda após aprovação | nova revisão; aprovação anterior deixa de valer |
| editor publica scheduled antes de scheduled_at | negado |
| editor publica scheduled vencido e aprovado | permitido |
| alterar conteúdo mantendo status published | negado |
| alterar tags de published | negado |
| owner administra membros editoriais | permitido |
| editor administra membros editoriais | negado |
| rollback com blog-media não vazio | aborta |

## Pendências antes de qualquer aplicação

1. validar sintaxe e execução em banco descartável/dev branch;
2. executar a matriz de RLS e workflow acima com usuários representativos;
3. validar advisors de segurança e performance após a aplicação descartável;
4. validar rollback completo no banco descartável;
5. confirmar quem será o primeiro owner antes de executar o bootstrap manual;
6. somente depois considerar aplicação em `vejamais-erp-staging`.
