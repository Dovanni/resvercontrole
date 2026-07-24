# ROSE-ME-F3 v1.0 — Detailed Migration, Backfill, Constraint, Index, RLS Transition, Validation, Dry-Run and Rollback Design

Framework: ROSE-ME-F3 (parent ROSE-ME-F2). Programa: ROSE_NATIVE_MULTITENANCY_TRANSFORMATION_PROGRAM (RNMTP).
Aplicação: GESTOR COMERCIAL E FINANCEIRO ROSÉ — resvercontrole.lovable.app (ROSE-CURRENT-01).
Natureza: 100% documental, read-only, fail-closed, zero mutation, zero breaking changes.

## 1. Estratégia Expand–Transition–Contract
- EXPAND: adiciona estruturas compatíveis (empresas, memberships, papéis, permissões, empresa_id nullable).
- TRANSITION: backfill idempotente, validação de tenant herdado, transição de índices/unicidades/constraints/RLS.
- CONTRACT: remoção de compatibilidades legadas, NOT NULL final, drop de policies antigas.
Nenhuma janela sem RLS. Nenhum acesso cross-tenant temporário.

## 2. 12 Estágios (S0–S11)
[
  [
    "S0",
    "AUTHORIZATION_CHANGE_FREEZE_AND_PRECONDITIONS"
  ],
  [
    "S1",
    "CAPABILITY_BACKUP_RESTORE_AND_PREFLIGHT_VALIDATION"
  ],
  [
    "S2",
    "CANONICAL_MULTITENANCY_STRUCTURAL_EXPANSION"
  ],
  [
    "S3",
    "SYSTEM_ROLES_PERMISSIONS_COMPANY_AND_OWNER_BOOTSTRAP"
  ],
  [
    "S4",
    "DIRECT_EMPRESA_ID_NULLABLE_EXPANSION"
  ],
  [
    "S5",
    "IDEMPOTENT_DIRECT_TENANT_BACKFILL"
  ],
  [
    "S6",
    "INHERITED_TENANT_PATH_VALIDATION"
  ],
  [
    "S7",
    "TENANT_INDEX_AND_UNIQUENESS_TRANSITION"
  ],
  [
    "S8",
    "CONSTRAINT_VALIDATION_AND_FINAL_NULLABILITY_TRANSITION"
  ],
  [
    "S9",
    "HELPER_FUNCTIONS_AND_RLS_TRANSITION"
  ],
  [
    "S10",
    "APPLICATION_STORAGE_INTEGRATION_AND_CUTOVER_TRANSITION"
  ],
  [
    "S11",
    "CONTRACT_CLEANUP_HOMOLOGATION_AND_CLOSURE"
  ]
]

## 3. Unidades de Migration
51 unidades documentadas em ROSE_ME_F3_FUTURE_MIGRATION_UNIT_REGISTRY.json; nenhuma executada.

## 4. Tabelas (25 = 17 diretas + 6 herdadas + 2 user-scoped)
- 17 diretas: aportes_financeiros, bank_accounts, cartoes_credito, categorias_contas_pagar, company_settings, compras, controle_vendas_diario, controle_vendas_fornecedor, customers, finance_entries, payables, payment_routing_rules, products, receivables, sales, suppliers, user_roles
- 6 herdadas: bank_movements, cartoes_faturas, cartoes_lancamentos, compras_itens, controle_vendas_fornecedor_historico, sale_items
- 2 user-scoped: audit_log, profiles

## 5. Bootstrap Canônico
Empresa inicial candidata: Angela Maria Momo Rodrigues MEI. OWNER: sac@resverarevenda.com.br.
Ordem: entidades → permissões → papéis → papel-permissões → empresa → OWNER → auditoria → backfill.

## 6. Backfill
Idempotente, lote quando necessário, origem = empresa canônica. Aborta em divergência financeira, tenant nulo/inesperado, FK inválida.

## 7. Órfãos e Ambiguidades
8 classes; sem atribuição automática; bloqueia avanço até decisão humana.

## 8. Constraints, Índices, Unicidades
- Constraints: NOT VALID → VALIDATE → NOT NULL → CONTRACT drop legacy.
- Índices: 53 atuais reconciliados; 17 EXTEND + 17 ADD; criação CONCURRENTLY.
- Unicidades: GLOBAL preservada quando lógica; caso contrário composta por tenant; dupla temporária.

## 9. Funções auxiliares (8)
current_user_company_memberships, current_user_active_company, has_company_permission, is_company_member, assert_company_member, company_role_of_user, user_can_switch_company, platform_admin_readonly_scope — SECURITY DEFINER mínimo, search_path fixo.

## 10. RLS (3 estados, 25 tabelas, 100 contratos por operação)
CURRENT → TRANSITION (dual, preserva usuário atual, sem cross-tenant) → FINAL (deny-by-default + membership).

## 11. Aplicação / Storage / Integrações / Jobs
Feature flag + kill switch; cache particionado; Storage `empresa_id/modulo/...`; jobs por empresa.

## 12. Baseline (SHA-256 689af23fb305255932cf86b48d4774775877d4a65061528e11b61487192a9a39)
9 checkpoints B0..B8. Divergência financeira ⇒ abort + R2/R3.

## 13. Dry-Run
Ambiente isolado, sem side effects. dry_run_executed=false.

## 14. Testes (16 categorias + 15 negativos de isolamento)
Ver ROSE_ME_F3_STRUCTURAL_DATA_RLS_ISOLATION_AND_ROLLBACK_TEST_MATRIX.json.

## 15. Escada de Rollback R0–R3
R0 ABORT · R1 UNIT · R2 STAGE · R3 FULL_RESTORE.

## 16. Governança
HUMAN_PRODUCT/TECHNICAL/DATABASE/SECURITY/PRIVACY/FINANCIAL_VALIDATOR/CHANGE_APPROVER/AUDIT_OBSERVER. IA não ocupa papéis. Four-eyes obrigatório.

## 17. Decisão
READY_FOR_CONTROLLED_STRUCTURAL_EXPAND_IMPLEMENTATION_AFTER_EXPLICIT_HUMAN_AUTHORIZATION_AND_OPERATIONAL_PRECONDITIONS.
F4 não autorizada automaticamente. Nada foi executado nesta fase.
