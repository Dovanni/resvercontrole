# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-I.3 — Validação executável em banco descartável

Laboratório: `vejamais-blog-lab`
Project ref: `vxmgjogrkiitjbteqcia`
Região: `sa-east-1`
Custo informado pelo Supabase: US$ 0/mês.

O projeto `vejamais-erp-staging` não foi alterado durante esta fase.

## Preparação do laboratório

O laboratório Free é vazio e não replica automaticamente os helpers da matriz. A migration do Blog reutiliza `public.set_updated_at()`, existente no staging. Para reproduzir o contrato do staging, foi criada somente no laboratório a fixture `lab_fixture_set_updated_at`, com a mesma função.

## Aplicação da migration

A migration canônica `20260902143100_blog_editorial_v2_schema.sql` foi aplicada com sucesso no laboratório.

Validações estruturais:

- 9 tabelas `public.blog_*` criadas;
- RLS habilitado nas 9 tabelas;
- triggers de guard, revisão, workflow e `updated_at` criados;
- schema privado `blog_private` criado;
- bucket `blog-media` criado como público, limite 5 MiB, MIME JPEG/PNG/WebP/AVIF;
- taxonomia e autor institucional criados.

## Matriz funcional executada

Identidades fictícias foram criadas exclusivamente no laboratório para simular `owner`, `editor`, `author`, `reviewer` e usuário ERP comum.

Resultados:

- usuário ERP comum vê 0 drafts: APROVADO;
- usuário ERP comum tentando criar post: bloqueado por `BLOG_EDITORIAL_WRITE_FORBIDDEN`: APROVADO;
- author usando author_id de outro perfil: bloqueado por `BLOG_AUTHOR_ID_MUST_MATCH_EDITORIAL_MEMBER`: APROVADO;
- author criando próprio draft: APROVADO;
- author enviando draft para review: APROVADO;
- editor tentando publicar sem aprovação: bloqueado por `BLOG_CURRENT_REVISION_REQUIRES_APPROVAL`: APROVADO;
- reviewer independente aprovando revisão: APROVADO;
- revision_number informado pelo cliente foi sobrescrito pela revisão corrente: APROVADO;
- edição material após aprovação incrementou revisão 1 -> 2: APROVADO;
- aprovação da revisão 1 não autorizou publicação da revisão 2: APROVADO;
- nova aprovação da revisão 2 permitiu publicação: APROVADO;
- post publicado ficou visível para `anon`: APROVADO;
- editor tentando aprovar a própria revisão: bloqueado por `BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN`: APROVADO;
- scheduled -> published antes de `scheduled_at`: bloqueado por `BLOG_SCHEDULED_PUBLICATION_NOT_DUE`: APROVADO;
- editor pode gerenciar mídia de post scheduled: APROVADO;
- usuário ERP comum não pode gerenciar mídia editorial: APROVADO.

A trilha também foi verificada: post publicado com revisão 2 possuía 2 snapshots de revisão, 3 eventos de workflow e 2 pareceres; post scheduled possuía 1 snapshot, 3 eventos e 1 parecer.

## Supabase Advisors — primeira passagem

Security:

- nenhum warning de segurança introduzido pelas funções `blog_private`;
- warning `function_search_path_mutable` somente para `public.set_updated_at()`, helper preexistente da matriz reproduzido como fixture no laboratório;
- warning geral de Auth `auth_leaked_password_protection` pertence à configuração do projeto laboratório, não ao módulo Blog.

Performance:

Foram encontrados:

- FKs de auditoria sem índices dedicados;
- policies permissivas duplicadas em alguns SELECTs e no UPDATE de `blog_posts`;
- `unused_index`, esperado em um banco recém-criado com poucas consultas.

## Hardening derivado dos Advisors

Foi criado `supabase/manual/blog_editorial_v2_lab_advisor_hardening.sql` para validação, ainda fora da migration automática. Ele:

- adiciona índices para FKs sinalizadas;
- consolida policies SELECT público/editorial;
- consolida as duas policies UPDATE de `blog_posts`.

O hardening foi aplicado no laboratório e a regressão RLS permaneceu verde.

Na segunda passagem do performance advisor desapareceram todos os avisos `unindexed_foreign_keys` e `multiple_permissive_policies`. Restaram somente `unused_index` INFO, esperado neste laboratório de baixa utilização.

Antes de staging, o hardening validado deve ser incorporado/squashado na migration canônica.

## Rollback — descoberta de laboratório

O rollback original tentou `DELETE FROM storage.buckets`. O Supabase bloqueou a operação com:

`Direct deletion from storage tables is not allowed. Use the Storage API instead.`

Como o rollback estava em transação, a tentativa falhou atomicamente e todo o módulo permaneceu intacto.

O rollback repository-only foi então corrigido para:

1. exigir que `blog-media` seja removido antes pela Storage API/Dashboard;
2. abortar antes de qualquer DDL se o bucket ainda existir;
3. somente depois remover policies, tabelas, funções e `blog_private`;
4. preservar `public.set_updated_at()`.

O guard corrigido foi validado no laboratório e abortou com `BLOG_ROLLBACK_STORAGE_BUCKET_STILL_EXISTS`, sem remover objetos SQL.

## Estado ao final da fase

- staging real: NÃO ALTERADO;
- laboratório: módulo Blog ainda instalado para permitir continuação dos testes;
- `blog-media`: existe e está vazio;
- rollback SQL: corrigido e guardado no repositório;
- rollback completo end-to-end: pendente apenas da remoção do bucket pela Storage API/Dashboard;
- hardening de advisors: validado no laboratório e pendente de squash na migration canônica antes de staging.
