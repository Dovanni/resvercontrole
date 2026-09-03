# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-N — Contratos Repository-Only das Mutações Editoriais

Status: implementação repository-only. Sem deploy, sem merge em `main`, sem importação de drafts e sem qualquer mutação real no Supabase.

## Objetivo

Preparar os contratos que futuramente poderão conectar o editor administrativo ao banco editorial, sem habilitar persistência nesta fase.

A camada criada transforma ações editoriais em envelopes de intenção tipados. Esses envelopes carregam ator, alvo, payload, plano de workflow e a barreira explícita `disabled_repository_only`.

## Arquivo principal

`src/features/blog/editorial-mutations.ts`

O módulo não importa o cliente Supabase e não contém chamadas `insert`, `update`, `delete`, `upload` ou RPC.

### Contratos disponíveis

- `createDraft()`;
- `updateDraft()`;
- `submitReview()`;
- `recordReviewDecision()`;
- `returnToDraft()`;
- `schedulePost()`;
- `publishPost()`;
- `archivePost()`;
- `restoreDraft()`.

Cada função retorna um `EditorialMutationEnvelope` e nunca executa persistência.

## Envelope de mutação

Todo envelope registra:

- tipo da mutação;
- UUID do ator e papel editorial;
- post alvo, revisão, status de origem e status pretendido;
- payload normalizado;
- `EditorialCommandPlan` calculado pela máquina de workflow da Fase 3-M;
- `execution: disabled_repository_only`;
- `executable: false`;
- razão `BLOG_MUTATION_EXECUTION_DISABLED_REPOSITORY_ONLY`.

## Barreira de execução

`executeEditorialMutation()` existe deliberadamente como fail-closed.

Qualquer tentativa de atravessar a fronteira repository-only lança:

`BLOG_MUTATION_EXECUTION_DISABLED_REPOSITORY_ONLY`

Portanto, mesmo um chamador que construa corretamente um envelope não consegue persistir nada por esta camada.

## Alinhamento com o banco

Os contratos reaproveitam `planEditorialCommand()` e, consequentemente, mantêm antecipadamente no cliente:

- draft inicial;
- autor restrito ao próprio draft;
- four-eyes;
- decisão de review separada de transição de status;
- aprovação corrente antes de schedule/publish;
- agendamento futuro;
- requisitos editoriais mínimos de publicação;
- archive sem DELETE físico;
- restore de `archived` para `draft` apenas por owner/editor.

A autoridade definitiva permanece no Supabase por RLS, triggers e constraints quando a integração real for autorizada futuramente.

## Create draft

`createDraft()` normaliza a intenção como um post novo:

- `postId = null`;
- `status = draft`;
- `revisionNumber = 1`;
- `createdByUserId = actor.userId` no plano de cliente;
- nenhuma aprovação, agendamento ou publicação herdada.

Isso espelha o comportamento do trigger do banco, que futuramente define `created_by = auth.uid()` e força o status inicial `draft`.

## Testes

Foi adicionada a suíte:

`src/features/blog/editorial-mutations.test.ts`

Ela cobre:

- criação de envelope de novo draft sem ID persistido;
- normalização imutável do payload;
- draft → review;
- decisões de revisão sem mudança automática de status;
- four-eyes;
- schedule futuro e aprovação corrente;
- publish aprovado;
- archive/restore sem exclusão física;
- bloqueio absoluto da função de execução.

O workflow `Blog Editorial V2 Validation` agora executa todas as suítes `src/features/blog/*.test.ts` antes do build completo.

## Contratos preservados

- três artigos continuam locais e `draft`;
- zero inserts em `blog_posts`;
- zero updates;
- zero reviews persistidos;
- zero uploads em `blog-media`;
- zero migrations;
- zero alterações em Auth ou memberships;
- zero alterações Cloudflare;
- zero deploys;
- `main` permanece fora da execução.

## Próxima fronteira sugerida

A próxima fase poderá construir um **adaptador Supabase de mutação desabilitado por feature flag**, com mapeamento exato de IDs relacionais (categoria, autor, tags), tratamento dos erros dos triggers e testes contra o ambiente de laboratório/staging em transação controlada. A habilitação de qualquer escrita real deverá depender de autorização explícita separada.
