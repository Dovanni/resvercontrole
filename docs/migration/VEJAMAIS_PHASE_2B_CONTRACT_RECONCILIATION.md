# VEJAMAIS ERP — Fase 2-B: Reconciliação de Contratos e Dependências

## Escopo e decisão

Execução estritamente repository-only na branch `migration/cloudflare-staging`. Foram
comparados runtime, tipos gerados e baseline canônico sem conexão ou execução em banco,
Supabase, Cloudflare, DNS ou produção.

Decisão: `PHASE_2B_REPOSITORY_CONTRACTS_CERTIFIED_READY_FOR_HUMAN_REVIEW`.

## Inventário material

| Dimensão | Resultado |
|---|---:|
| Migrations históricas de origem | 173 |
| Tabelas públicas finais | 38 |
| Tabelas nos tipos gerados | 38 |
| Relacionamentos tipados reconciliados | 52 |
| Tabelas consultadas diretamente pelo runtime | 25 |
| RPCs referenciadas pelo runtime | 15 |
| Funções canônicas | 55 |
| Triggers | 39 |
| Policies | 45 |
| Tabelas com RLS | 38 |
| Funções `SECURITY DEFINER` com `search_path` | 54/54 |

## Correções compatíveis e limitadas

1. Projetadas explicitamente as colunas finais criadas historicamente em blocos `DO`,
   incluindo `empresa_id`, isolamento `livemode` e ordenação monotônica Stripe.
2. Adicionada implementação segura de `reconcile_and_finalize_onboarding()`, baseada em
   `auth.uid()`, `finalize_user_onboarding(uuid)` e `ensure_empresa_defaults(uuid, uuid)`.
   Nenhum UUID de banco foi incorporado.
3. Removido o grant direto de `ensure_empresa_defaults` para `authenticated`; a função
   permanece interna e acessível por fluxo controlado.
4. Alinhadas as duas chamadas de `accept_company_invitation` ao contrato final de um único
   argumento `_token_hash`, com identidade derivada do token autenticado.
5. O cliente global foi removido das funções server-side multiempresa; passa-se a usar o
   cliente autenticado fornecido pelo middleware.
6. Removidas dos tipos as referências residuais a `rpc_registrar_compra_test` e à coluna
   `error_payload`, ambas ausentes no estado final canônico.

## Ordem de aplicação futura

| Ordem | Artefato | Dependência satisfeita |
|---:|---|---|
| 1 | `00000000000000_vejamais_canonical_schema_candidate.sql` | tipos, tabelas, colunas, FKs, constraints e índices |
| 2 | `00000000000001_vejamais_canonical_functions_candidate.sql` | funções e triggers após existência das relações |
| 3 | `00000000000002_vejamais_canonical_security_candidate.sql` | RLS, policies e grants após funções |

## Rollback futuro

O primeiro ensaio deverá ocorrer exclusivamente em projeto staging vazio. Em falha, o
rollback autorizado é o descarte integral do staging e sua recriação vazia. Não aplicar
rollback parcial ou inversões SQL não certificadas.

## Gates restantes

- revisão humana dos três SQLs;
- criação/autorização explícita de staging isolado;
- aplicação única na ordem documentada;
- regeneração de tipos a partir do staging e comparação byte/semântica;
- testes funcionais contra staging;
- somente depois, plano separado de Cloudflare e produção.
