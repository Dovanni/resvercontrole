# VEJAMAIS ERP — Fase 2-C: Preflight Final do Baseline Canônico

## Escopo e decisão

O preflight foi executado exclusivamente sobre o repositório na branch
`migration/cloudflare-staging`. Nenhum SQL foi executado e não houve conexão com banco,
Supabase, Cloudflare, DNS ou produção.

**Decisão:** `PHASE_2C_CANONICAL_BASELINE_STATIC_PREFLIGHT_CERTIFIED_READY_FOR_CONTROLLED_EMPTY_STAGING_APPLICATION`

## Bloqueios encontrados e correções

O primeiro passe bloqueou o pacote por dois motivos materiais:

1. 13 chaves estrangeiras apontavam para tabelas públicas criadas posteriormente;
2. `bank_movements_origin_check` era adicionada três vezes, sem remoção intermediária.

Os 38 blocos `CREATE TABLE` foram reordenados topologicamente, sem mudança de colunas ou
semântica. As duas versões intermediárias e superadas da constraint foram removidas; a
definição final, que contém todos os valores admitidos, foi preservada.

## Certificação estática

- 90 verificações aprovadas e zero falhas;
- 38 tabelas e zero referências antecipadas entre tabelas públicas;
- 55 funções, 39 triggers e todas as dependências-alvo presentes;
- 38 tabelas com RLS e 45 policies, sem nomes duplicados por tabela;
- 57 índices com nomes únicos;
- 54 funções `SECURITY DEFINER`, todas com `search_path` explícito;
- 10 grants explícitos de funções e nenhum grant global de execução para `authenticated`;
- delimitadores, strings, comentários, dollar quotes e parênteses balanceados;
- ausência de DML operacional, `DO`, `COPY`, `TRUNCATE` ou `MERGE` no nível superior.

A validação de sintaxe desta fase é deliberadamente estática: ela valida estrutura léxica,
fronteiras de statements e dependências, mas não substitui o parse do PostgreSQL que só
ocorrerá no futuro gate de staging autorizado.

## Pacote exato

| Ordem | Arquivo | SHA-256 |
|---:|---|---|
| 1 | `00000000000000_vejamais_canonical_schema_candidate.sql` | `42836d0b043d91a84816a55f3821a1bad42ebec5a73e7ef76dcca955251c73c3` |
| 2 | `00000000000001_vejamais_canonical_functions_candidate.sql` | `b150ab69134d08c76943d0e9a7aecc92d1d15d440c0f117e29038012da892fd7` |
| 3 | `00000000000002_vejamais_canonical_security_candidate.sql` | `1c52b461c90e0c51cfe8b501a4aa5abb99283ddc7747eff371dcb6ae5393d45b` |

O arquivo `APPLICATION_PLAN.json` é a especificação operacional vinculante para a futura
aplicação. Qualquer diferença de hash, ordem, alvo, estado vazio ou resultado bloqueia a
execução.

## Interrupção e rollback

Não é permitido continuar após erro ou divergência. Como o futuro alvo será um projeto
staging vazio e descartável, o único rollback autorizado é descartar e recriar o projeto
staging. Rollback in-place permanece proibido para não conservar estado parcial oculto.

Auth, Storage, Edge Functions, secrets, dados operacionais, Cloudflare, DNS e produção
permanecem fora deste pacote e exigem fases próprias.
