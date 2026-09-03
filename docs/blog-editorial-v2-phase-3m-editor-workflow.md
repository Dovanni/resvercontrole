# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-M — Projeto Repository-Only do Editor Administrativo e Workflow de Escrita

Status: implementação repository-only. Sem deploy, sem merge em `main`, sem importação de drafts e sem mutações no Supabase.

## Objetivo

Projetar e validar a experiência do editor administrativo e do workflow editorial antes de habilitar qualquer operação persistente.

A fase introduz contratos de formulário, permissões por papel e planejamento de transições em memória, mantendo RLS e triggers do banco como autoridade futura.

## Arquitetura

### `src/features/blog/editorial-workflow.ts`

Camada pura, sem cliente Supabase e sem chamadas remotas.

Responsabilidades:

- contrato `EditorialEditorForm`;
- ator editorial (`owner`, `editor`, `author`, `reviewer`);
- validação de draft;
- validação de requisitos editoriais para agendamento/publicação;
- comandos disponíveis por papel/status;
- planejamento de transições;
- simulação imutável em memória;
- marcador explícito `persistence: disabled_repository_only` em todo plano de comando.

### Comandos modelados

- `save_draft`;
- `submit_review`;
- `request_changes`;
- `approve_revision`;
- `return_to_draft`;
- `schedule`;
- `publish`;
- `archive`;
- `restore_draft`.

`request_changes` e `approve_revision` são decisões de revisão e mantêm o post em `review`. A transição `review → draft` é representada separadamente por `return_to_draft` e fica restrita a `owner/editor`, refletindo o contrato do banco.

## Regras antecipadas no frontend

As validações do cliente melhoram UX, mas não substituem o servidor.

O protótipo antecipa:

- slug obrigatório e formato canônico;
- título e excerpt obrigatórios;
- tempo de leitura positivo;
- criação/edição de autor restrita ao próprio draft;
- four-eyes para decisão de revisão;
- aprovação da revisão atual antes de schedule/publish;
- agendamento futuro;
- categoria, autor, metadados e conteúdo estruturado antes de publicação;
- archive/restore reservados a owner/editor.

RLS, triggers e constraints continuam sendo a autoridade definitiva quando mutações forem futuramente conectadas.

## Rota de laboratório

Foi criado o endereço `/editorial/editor` usando uma rota não aninhada visualmente (`src/routes/editorial_.editor.tsx`).

A tela:

- exige sessão autenticada;
- exige membership ativo em `blog_editorial_members`;
- não converte papel do ERP em papel editorial;
- carrega apenas os três drafts locais do preview como material de laboratório;
- permite alterar campos somente em memória;
- mostra comandos compatíveis com o papel e o status;
- mostra o plano calculado e erros de contrato;
- identifica de forma visível que a persistência está bloqueada.

Não existem chamadas de `insert`, `update`, `delete`, `upload` ou RPC nesta rota.

## Contratos preservados

- três artigos continuam locais e `draft`;
- zero importações para `blog_posts`;
- zero criação de posts no staging;
- zero alterações de posts no staging;
- zero reviews persistidos;
- zero uploads em `blog-media`;
- zero migrations;
- zero alterações em Auth;
- zero alterações Cloudflare;
- zero deploys;
- `main` permanece fora da execução.

## Testes

A suíte `src/features/blog/blog.test.ts` foi ampliada para validar:

- persistência explicitamente desabilitada;
- autor só submete o próprio draft;
- transição simulada draft → review sem mutar o objeto original;
- four-eyes;
- aprovação obrigatória antes de publish/schedule;
- schedule apenas no futuro;
- requisitos editoriais de publicação;
- archive/restore por owner/editor.

O workflow `Blog Editorial V2 Validation` continua executando testes e build a cada commit na branch.

## Próxima fronteira sugerida

Uma fase posterior poderá preparar os adaptadores de mutação (`createDraft`, `updateDraft`, `submitReview`, `recordReviewDecision`, `schedulePost`, `publishPost`, `archivePost`) como contratos repository-only, ainda desacoplados da UI ou protegidos por feature flag. A conexão real desses adaptadores ao Supabase deverá exigir autorização explícita e nova validação contra RLS/triggers antes de qualquer importação dos três drafts existentes.
