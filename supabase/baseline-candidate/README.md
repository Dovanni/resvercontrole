# VEJAMAIS ERP — Baseline Canônico Candidate v3

Status: **FASE 2-E APROVADA — APLICAÇÃO BLOQUEADA ATÉ NOVA AUTORIZAÇÃO HUMANA**

Este pacote foi sintetizado estaticamente a partir das 173 migrations da branch
`migration/cloudflare-staging` e reconciliado com os contratos do runtime e os tipos
gerados na Fase 2-B. Nenhum SQL foi executado e nenhuma conexão externa foi realizada.

## Ordem futura de aplicação

1. `00000000000000_vejamais_canonical_schema_candidate.sql`
2. `00000000000001_vejamais_canonical_functions_candidate.sql`
3. `00000000000002_vejamais_canonical_security_candidate.sql`

Essa ordem preserva as dependências: tipos/tabelas/constraints/índices, depois funções e
triggers, por último RLS, policies e grants.

Os 38 blocos de criação de tabelas estão em ordem topológica: não existem referências a
tabelas públicas ainda não criadas. O pacote exato, hashes, precondições, critérios de
interrupção e rollback estão em `APPLICATION_PLAN.json`.

## Conteúdo reconciliado

- 38 tabelas públicas e 52 relacionamentos tipados;
- 55 funções finais, incluindo a substituição segura de
  `reconcile_and_finalize_onboarding()` sem UUIDs de banco;
- 39 triggers com todas as funções-alvo presentes;
- 45 policies e RLS habilitado nas 38 tabelas;
- grants explícitos para `authenticated`, sem execução global de funções;
- contratos de frontend e tipos alinhados a `accept_company_invitation(text)`;
- colunas finais antes ocultas em blocos dinâmicos projetadas explicitamente;
- ausência do RPC de teste `rpc_registrar_compra_test` e de sua tipagem.

## Exclusões obrigatórias

- DML operacional e backfills históricos;
- migrations duplicadas ou semanticamente equivalentes;
- `blog_posts` e `blog_categories` do piloto VSEO;
- `private.snapshots` e `private.manifests` do incidente histórico;
- definições históricas de `reconcile_and_finalize_onboarding()` acopladas a UUIDs;
- `public.rpc_registrar_compra_test`;
- overloads legados de `public.get_company_subscription_context` removidos no estado final;
- UUIDs e dados vinculados ao banco anterior;
- grant global de execução de funções para `authenticated`;
- criação/configuração de Auth, Storage, Edge Functions e Secrets.

## Rollback planejado

Como a primeira aplicação autorizada deverá ocorrer em um projeto Supabase staging vazio,
o rollback recomendado é descartar integralmente esse projeto staging e recriá-lo vazio.
Não existe rollback in-place neste pacote, pois ele poderia preservar estado parcial e
produzir uma falsa equivalência. Nenhuma ação de rollback foi executada nesta fase.

## Preflight Fase 2-C

- 90 verificações estáticas aprovadas, zero falhas;
- duplicações materiais de constraint removidas, preservando somente a definição final;
- sintaxe validada estaticamente quanto a delimitadores, statements e dependências;
- nenhuma validação foi executada por um servidor PostgreSQL nesta fase.

Consulte `PREFLIGHT_CERTIFICATION.json` e execute
`node scripts/migration/verify-canonical-preflight.mjs` antes de qualquer gate futuro.

## Correção de ordem Fase 2-E

- as adições já existentes de `empresa_id` em `payment_routing_rules` e
  `categorias_contas_pagar` foram movidas para antes das constraints que as utilizam;
- nenhuma instrução executável foi adicionada, removida ou reescrita;
- linhas, bytes e multiconjunto de linhas do schema permaneceram idênticos;
- o preflight agora simula a ordem real e valida colunas usadas por constraints e índices;
- 100 verificações aprovadas, incluindo 186 constraints, 57 índices e 372 referências
  sequenciais de coluna, com zero falhas;
- functions e security permaneceram byte a byte inalterados.

## Limites e próximo gate

O pacote permanece fora de `supabase/migrations/`, impedindo aplicação automática. Antes
de qualquer uso requer revisão SQL independente, autorização humana e execução controlada
em staging vazio, seguida de certificação material. Cloudflare, DNS e produção continuam
fora de escopo.

`PHASE_2E_ORDERED_COLUMN_DEPENDENCIES_STATICALLY_CERTIFIED_AWAITING_HUMAN_APPROVAL`
