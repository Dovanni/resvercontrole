# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-P — Resolução Repository-Only de Referências e Plano Transacional

Status: implementação repository-only. Sem deploy, sem merge em `main` e sem mutações no Supabase.

## Objetivo

Eliminar placeholders e ambiguidades do adaptador de escrita antes de qualquer habilitação real de persistência.

Esta fase projeta:

- resolução determinística de categoria, autor e tags para UUIDs canônicos;
- rejeição de referências inexistentes, inativas ou ambíguas;
- sincronização atômica de tags;
- ordem transacional das futuras mutações;
- controle otimista de concorrência por `revision_number`;
- fail-closed permanente enquanto a feature flag de escrita estiver OFF.

## Novo módulo

`src/features/blog/editorial-transaction-plan.ts`

O módulo é puro e não importa o cliente Supabase.

### Catálogos de referência

A resolução recebe explicitamente um catálogo já conhecido de:

- categorias: `id`, `slug`, `name`, `active`;
- autores: `id`, `slug`, `displayName`, `active`;
- tags: `id`, `slug`, `name`, `active`.

Somente referências ativas participam da resolução.

A correspondência aceita slug ou nome/display name, com normalização de espaços e caixa. O resolver nunca escolhe arbitrariamente entre múltiplas correspondências.

### Falhas explícitas

Foram definidos códigos específicos:

- `BLOG_CATEGORY_REFERENCE_NOT_FOUND`;
- `BLOG_CATEGORY_REFERENCE_AMBIGUOUS`;
- `BLOG_AUTHOR_REFERENCE_NOT_FOUND`;
- `BLOG_AUTHOR_REFERENCE_AMBIGUOUS`;
- `BLOG_TAG_REFERENCE_NOT_FOUND`;
- `BLOG_TAG_REFERENCE_AMBIGUOUS`.

Se qualquer referência obrigatória não puder ser resolvida de forma única, `resolved = null` e o plano permanece bloqueado.

## Sincronização de tags

Para `createDraft`:

1. inserir `blog_posts`;
2. capturar o UUID retornado;
3. inserir as associações em `blog_post_tags` dentro da mesma futura transação.

Para `updateDraft`:

1. atualizar o post com guarda otimista `id + revision_number`;
2. somente se exatamente uma linha for afetada, remover associações atuais de `blog_post_tags`;
3. inserir o novo conjunto canônico de tags;
4. commit único.

Se qualquer etapa falhar, a futura implementação deverá fazer rollback de toda a unidade.

## Concorrência otimista

Todas as mutações sobre posts existentes carregam:

`WHERE id = post_id AND revision_number = expected_revision`

O contrato exige exatamente uma linha afetada.

- `1` linha → resultado esperado;
- `0` linhas → revisão mudou desde a leitura, conflito;
- mais de `1` linha → invariável violada, também tratado como conflito.

Código canônico:

`BLOG_EDITORIAL_REVISION_CONFLICT`

Isso impede que uma sessão editorial sobrescreva silenciosamente alterações feitas por outra sessão.

## Ordem transacional

Os planos são explicitamente marcados como:

- `atomic = true`;
- `isolationExpectation = single_database_transaction`;
- `executable = false`;
- `featureFlag = false`;
- `executionMode = disabled_repository_only`.

As decisões de revisão continuam sendo `INSERT` em `blog_post_reviews`; o trigger do banco continua responsável por validar revisão corrente e four-eyes.

Transições de status continuam sendo `UPDATE` de `blog_posts` protegidos por `revision_number`; os triggers permanecem autoridade do workflow.

## Barreiras preservadas

`executeEditorialTransaction()` sempre lança:

`BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF`

Portanto esta fase não introduz qualquer caminho real de persistência.

## Testes

Foi criada a suíte `src/features/blog/editorial-transaction-plan.test.ts`, cobrindo:

- resolução canônica de categoria/autor/tags;
- deduplicação de tags;
- referência ausente;
- referência ambígua;
- referência inativa;
- ordem create post → tags;
- update otimista → delete tags → insert tags;
- status transition com guarda de revisão;
- review decision como insert isolado;
- schedule ainda com flag OFF;
- conflito quando o affected-row count não é exatamente 1;
- executor final fail-closed;
- ausência de passos quando o contrato do cliente já está rejeitado.

## Estado preservado

- zero INSERT no Supabase;
- zero UPDATE no Supabase;
- zero DELETE no Supabase;
- zero RPC;
- zero Storage upload;
- zero migrations nesta fase;
- três drafts continuam locais;
- Cloudflare intacto;
- `main` intacto;
- nenhum deploy.

## Próxima fronteira sugerida

A próxima fase pode projetar um **orquestrador transacional desabilitado** que una leitura de referências, geração do plano, execução futura e reconciliação pós-escrita, ainda mantendo o caminho real de rede bloqueado. Somente uma fase posterior, mediante autorização específica, deverá testar essas mutações contra um ambiente controlado antes de qualquer ativação no staging.