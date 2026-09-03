# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-O — Adaptador Supabase de Escrita em Modo Desabilitado

Status: implementação repository-only. Sem deploy, sem merge em `main`, sem importação de drafts e sem mutações no Supabase.

## Objetivo

Preparar o formato exato das futuras operações de escrita do Blog Editorial V2 contra o Supabase, mantendo uma barreira técnica explícita que impede qualquer chamada real ao banco nesta fase.

A implementação não conecta o editor a `insert`, `update`, `delete`, RPC ou Storage. Ela apenas transforma os contratos repository-only da Fase 3-N em planos de escrita tipados e não executáveis.

## Arquivo principal

`src/features/blog/editorial-supabase-write.adapter.ts`

### Feature flag hard-coded

O módulo declara:

- `EDITORIAL_SUPABASE_WRITES_ENABLED = false`;
- `EDITORIAL_SUPABASE_WRITE_MODE = disabled_repository_only`.

A flag não depende de variável de ambiente. Portanto, não pode ser ativada acidentalmente por configuração de deploy. Uma futura ativação exige alteração explícita de código, revisão e nova fase autorizada.

## Fronteira sem cliente Supabase

O adaptador desta fase deliberadamente **não importa o cliente Supabase**.

`planSupabaseEditorialWrite()` apenas produz um `SupabaseEditorialWritePlan` com:

- mutation kind;
- ator e papel editorial;
- post/revisão/status;
- passos futuros por tabela/operação;
- referências ainda não resolvidas (`category_id`, `author_id`, `tag_ids`);
- `featureFlag: false`;
- `executable: false`;
- motivo de bloqueio.

`executeSupabaseEditorialWrite()` existe como barreira fail-closed e sempre lança:

`BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF`

## Mapeamentos preparados

### Draft

`createDraft` → futuro `INSERT blog_posts` + sincronização de `blog_post_tags`.

`updateDraft` → futuro `UPDATE blog_posts` + sincronização de `blog_post_tags`.

Os campos protegidos pelo banco (`created_by`, `updated_by`, `revision_number`) não são fabricados pelo adaptador.

Categoria, autor e tags permanecem como referências sem resolver até uma fase posterior de resolução contra IDs canônicos do banco.

### Workflow

`submitReview`, `returnToDraft`, `publishPost`, `archivePost`, `restoreDraft` → futuros `UPDATE blog_posts` limitados ao status solicitado.

O adaptador não define `reviewed_by`, `published_by`, `published_at` ou `updated_by`; triggers permanecem autoridade desses campos.

### Revisão

`recordReviewDecision` → futuro `INSERT blog_post_reviews`.

O adaptador não envia `reviewer_user_id`; o trigger do banco continua responsável por derivar o usuário autenticado e validar four-eyes/revisão corrente.

### Agendamento

`schedulePost` → futuro `UPDATE blog_posts` com apenas `status='scheduled'` e `scheduled_at`.

Aprovação, revisão e validade temporal continuam sendo validadas pelo contrato cliente e, futuramente, pelos triggers/RLS do banco.

## Normalização de erros

`normalizeEditorialWriteError()` prepara mensagens controladas para:

- erros dos triggers `BLOG_*`;
- RLS/Postgres `42501`;
- conflito único `23505`;
- demais constraints `23xxx`;
- sessão/Auth;
- erro desconhecido.

A finalidade é evitar que a UI dependa diretamente de mensagens internas do PostgreSQL quando a escrita real for habilitada.

## Contratos preservados

- feature flag de escrita OFF;
- executor sempre fail-closed;
- zero cliente Supabase no adaptador;
- zero `insert` real;
- zero `update` real;
- zero `delete` real;
- zero RPC;
- zero upload em `blog-media`;
- zero importação dos três drafts locais;
- zero migrations;
- zero alterações Auth;
- zero alterações Cloudflare;
- zero deploys;
- `main` permanece fora da execução.

## Testes

Foi criada `src/features/blog/editorial-supabase-write.adapter.test.ts` para provar:

- flag hard-coded OFF;
- plano de criação de draft não executável;
- mapeamento de envio para revisão;
- decisão de review sem `reviewer_user_id` fabricado;
- agendamento sem metadados de publicação fabricados;
- executor fail-closed;
- normalização de trigger/RLS/conflito;
- bloqueio anterior ao adaptador quando o contrato cliente falha.

O workflow `Blog Editorial V2 Validation` executa todas as suítes `src/features/blog/*.test.ts` e o build completo.

## Próxima fronteira sugerida

A próxima fase pode ser uma **Fase 3-P — Resolução Repository-Only de Referências e Plano Transacional**, preparando como nomes/slugs editoriais serão resolvidos para `category_id`, `author_id` e `tag_ids`, como sincronizar tags atomicamente e como lidar com concorrência/revision_number, ainda sem ativar escrita real.
