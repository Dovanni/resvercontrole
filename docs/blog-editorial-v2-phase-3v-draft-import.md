# Blog Editorial V2 — Fase 3-V — Importação Controlada dos 3 Drafts

## Escopo executado

A Fase 3-V aplicou no projeto `vejamais-erp-staging` a RPC transacional de drafts na mesma sequência validada executavelmente no `vejamais-blog-lab` e importou os três artigos homologados do repositório exclusivamente com `status = 'draft'`.

Nenhum artigo foi enviado para revisão, aprovado, agendado ou publicado.

## Pré-condições confirmadas

Antes da alteração:

- `blog_posts = 0`;
- exatamente um owner editorial ativo;
- a conta institucional autorizada permanecia sem `user_roles`, `user_company_access` ou `profiles` do ERP;
- as categorias `Gestão Financeira`, `Estoque e Compras` e `Gestão Multiempresa` existiam e estavam ativas;
- o autor `Equipe Editorial VEJAMAIS ERP` existia e estava ativo;
- `blog_tags = 0`;
- `public.set_updated_at()` permanecia existente;
- a RPC ainda não existia no staging.

## RPC aplicada

Foram aplicadas, na mesma ordem comprovada no laboratório:

1. `blog_editorial_v2_draft_transaction_rpc`;
2. `blog_editorial_v2_draft_rpc_qualification_fix`.

A segunda definição qualifica `blog_post_tags.post_id` no `DELETE` de sincronização de tags, eliminando a ambiguidade PL/pgSQL encontrada no laboratório.

A função final é `public.blog_save_draft_transaction(...)`, `SECURITY INVOKER`, executável apenas por `authenticated`. RLS, membership editorial, triggers e `auth.uid()` permanecem autoridades de autorização.

## Tags criadas

Foram criadas nove tags canônicas necessárias aos conteúdos:

- fluxo de caixa;
- contas a pagar;
- contas a receber;
- estoque;
- inventário;
- compras;
- multiempresa;
- controle de acesso;
- gestão.

## Drafts importados

1. `como-organizar-fluxo-de-caixa-empresa`
   - título: Como organizar o fluxo de caixa da empresa
   - categoria: Gestão Financeira
   - tags: fluxo de caixa, contas a pagar, contas a receber
   - status: draft
   - revisão: 1

2. `como-evitar-divergencias-no-estoque`
   - título: Como evitar divergências no estoque da sua empresa
   - categoria: Estoque e Compras
   - tags: estoque, inventário, compras
   - status: draft
   - revisão: 1

3. `gestao-multiempresa-sem-misturar-contextos`
   - título: Gestão multiempresa: como centralizar sem misturar contextos
   - categoria: Gestão Multiempresa
   - tags: multiempresa, controle de acesso, gestão
   - status: draft
   - revisão: 1

Todos utilizam o autor institucional `Equipe Editorial VEJAMAIS ERP`.

## Auditoria pós-importação

Estado confirmado imediatamente após a transação:

- `blog_posts = 3`;
- drafts = 3;
- published = 0;
- scheduled = 0;
- posts em revisão #1 = 3;
- posts criados pelo owner autorizado = 3;
- tags = 9;
- vínculos post/tag = 9;
- snapshots de revisão = 3;
- eventos de workflow = 3;
- reviews = 0;
- `published_at` preenchido = 0;
- `scheduled_at` preenchido = 0;
- os três artigos possuem 5 seções estruturadas;
- os três possuem meta title, meta description, focus keyword e alt text preenchidos.

## Prova de não-publicação

Uma consulta executada sob o papel `anon` retornou zero posts visíveis. Portanto os drafts importados continuam protegidos pela RLS e não estão publicamente disponíveis.

## Isolamento da matriz

Após a importação, a conta owner editorial continua com:

- `user_roles = 0`;
- `user_company_access = 0`;
- `profiles = 0`.

`public.set_updated_at()` continua existente.

Nenhuma alteração foi feita em empresas, vendas, compras, estoque, financeiro, billing/Stripe, onboarding, Auth operacional, Cloudflare ou deploy.

## Advisors

A auditoria pós-DDL não apresentou warning de segurança específico da nova RPC do Blog. A função foi criada como `SECURITY INVOKER`.

Os avisos de performance associados ao Blog são `unused_index`, compatíveis com o volume inicial de apenas três drafts. Outros warnings exibidos pelos Advisors pertencem à matriz preexistente e ficaram fora do escopo desta fase.

## Estado ao final

O banco editorial do staging contém agora os três conteúdos homologados como drafts reais, prontos para serem carregados pelo read model administrativo e pelo editor real, mas ainda sem qualquer revisão, aprovação, agendamento ou publicação.

A próxima fase recomendada é a Fase 3-W — Workflow Editorial Real, começando por uma auditoria controlada da capacidade de abrir os três drafts no painel/editor e, somente mediante autorização específica, executar o primeiro ciclo `draft → review → aprovação four-eyes`, sem publicação automática.