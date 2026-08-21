# VEJAMAIS ERP — Baseline Canônico Candidate v1

Status: **CANDIDATO REPOSITORY-ONLY — NÃO EXECUTAR**

Este pacote foi sintetizado estaticamente a partir das 173 migrations da branch
`migration/cloudflare-staging`, no HEAD `1c878ee6e59ba6c2ba80a191dabf711e7ff89067`.

## Conteúdo

- `00000000000000_vejamais_canonical_schema_candidate.sql`: 38 tabelas públicas, tipos, alterações estruturais e índices finais inferidos.
- `00000000000001_vejamais_canonical_functions_candidate.sql`: projeção final por nome das funções e triggers.
- `00000000000002_vejamais_canonical_security_candidate.sql`: RLS, policies finais e grants explícitos.
- `BASELINE_MANIFEST.json`: inventário mecânico, hashes e exclusões.

## Exclusões obrigatórias

- DML operacional e backfills históricos;
- migrations duplicadas ou semanticamente equivalentes;
- `blog_posts` e `blog_categories` do piloto VSEO;
- `private.snapshots` e `private.manifests` do incidente histórico;
- `public.rpc_registrar_compra_test`;
- `public.reconcile_and_finalize_onboarding` (RPC histórica acoplada a UUIDs do banco anterior);
- overloads legados de `public.get_company_subscription_context` removidos no estado final;
- UUIDs e dados vinculados ao banco anterior;
- grant global de execução de funções para `authenticated`;
- criação/configuração de Auth, Storage, Edge Functions e Secrets.

## Limites

Este pacote não foi executado em PostgreSQL ou Supabase. A síntese é estática e permanece
fora de `supabase/migrations/`, impedindo aplicação automática. Antes de qualquer uso deve
passar por revisão SQL independente, validação em banco efêmero autorizado e certificação humana.

O runtime ainda referencia `reconcile_and_finalize_onboarding`; essa dependência precisa ser
removida ou substituída em uma fase de código separada antes da validação em staging.

## Próximo gate

`PHASE_2A_CANONICAL_BASELINE_CANDIDATE_REQUIRES_STATIC_CERTIFICATION`
