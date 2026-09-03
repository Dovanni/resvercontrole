# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-J.1 — Aplicação controlada no staging

Projeto alvo: `vejamais-erp-staging` (`hoalgniwydgydqaugqph`).

## Autorização

Aplicação autorizada exclusivamente para o módulo Blog Editorial V2, sem bootstrap de owner, sem usuários editoriais reais, sem importação de drafts, sem frontend, sem deploy e sem publicação.

## Preflight

Antes da aplicação foi confirmado:

- `public.set_updated_at()` existente;
- `blog_private` inexistente;
- bucket `blog-media` inexistente;
- 0 tabelas `blog_*`;
- 0 policies do Blog;
- histórico de migrations encerrando em `20260831124358_fix_stripe_invoice_subscription_resolution`.

## Migrations aplicadas

1. `blog_editorial_v2_schema` — sucesso.
2. `blog_editorial_v2_post_lab_hardening` — sucesso.

Versões registradas pelo Supabase:

- `20260902172726_blog_editorial_v2_schema`
- `20260902172742_blog_editorial_v2_post_lab_hardening`

## Estado pós-aplicação

- 9 tabelas `blog_*`, todas com RLS habilitado;
- `blog_private` presente;
- 7 funções privadas do Blog;
- 9 triggers editoriais;
- 35 policies Blog/Storage;
- bucket `blog-media` presente;
- 7 categorias editoriais seedadas;
- 1 autor institucional `Equipe Editorial VEJAMAIS ERP`;
- 0 membros editoriais;
- 0 posts;
- `public.set_updated_at()` preservada.

## Teste seguro de isolamento

Foi usado UUID autenticado fictício, sem criar usuário Auth e sem persistir dados, dentro de transação com rollback.

Resultados:

- membership editorial: `false`;
- posts privados visíveis: `0`;
- tentativa de INSERT de post: bloqueada (`DENIED:P0001`);
- linha de probe persistida: `0`;
- `anon` vê as 7 categorias ativas;
- `anon` vê 0 posts.

## Guards estruturais confirmados

A definição efetivamente instalada contém:

- four-eyes / auto-review forbidden;
- aprovação obrigatória da revisão corrente;
- bloqueio de publicação agendada antes de `scheduled_at`;
- proibição de edição material mantendo status `published`;
- vínculo obrigatório entre `author` e seu `author_id`;
- uma única policy consolidada de UPDATE em `blog_posts`;
- 10 índices do hardening pós-lab.

## Advisors pós-aplicação

### Segurança

Nenhum novo warning específico das funções `blog_private` foi reportado. Permaneceram warnings preexistentes da matriz, incluindo `public.set_updated_at()` com search_path mutável e funções SECURITY DEFINER já existentes.

### Performance

O hardening do Blog foi efetivo: não apareceram `unindexed_foreign_keys` nem `multiple_permissive_policies` para tabelas `blog_*`. Os avisos do Blog são `unused_index`, esperados antes de haver artigos/tráfego. Outros warnings exibidos pertencem à matriz preexistente e ficaram fora do escopo.

## Limites preservados

Não foram executados:

- bootstrap do primeiro owner;
- alterações em usuários Auth reais;
- concessão de role editorial;
- importação dos 3 drafts;
- criação/publicação de posts;
- integração frontend;
- merge em `main`;
- deploy/Cloudflare;
- correções em warnings preexistentes da matriz.

## Veredito

Fase 3-J.1 concluída com sucesso. O schema editorial está instalado no staging, isolado e vazio de conteúdo/publicação. Próximas ações exigem nova autorização específica.