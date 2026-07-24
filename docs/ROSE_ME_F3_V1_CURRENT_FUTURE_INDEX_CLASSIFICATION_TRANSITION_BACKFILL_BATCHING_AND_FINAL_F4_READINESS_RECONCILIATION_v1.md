# ROSE-ME-F3-V1 v1.0 — Reconciliação corretiva de índices atuais/futuros, transição, batching de backfill e prontidão final para F4

Framework: ROSE-ME-F3-V1 (parent ROSE-ME-F3). Programa: RNMTP.
Aplicação: GESTOR COMERCIAL E FINANCEIRO ROSÉ — resvercontrole.lovable.app (ROSE-CURRENT-01).
Natureza: 100% documental, read-only, corretiva, zero mutation.

## 1. Precondição F3
32 artefatos F3 preservados; 960 checks; 0 mutações. Baseline SHA-256 689af23fb305255932cf86b48d4774775877d4a65061528e11b61487192a9a39 inalterada.

## 2. Lacuna original
Envelope F3 declarou 53 índices atuais mas classificou apenas 42 (25 PRESERVE + 17 EXTEND). Diferença de 11 não classificados. Classificação: MATERIAL_CURRENT_INDEX_DISPOSITION_RECONCILIATION_GAP.

## 3. Inventário real (pg_index, schema=public)
53 índices: 25 PK, 7 UNIQUE não-PK (2 parciais), 21 non-unique. 19 compostos, 34 simples. 2 parciais, 0 expressão. 0 inválidos.

## 4. Classificação exclusiva V1 (soma = 53)
- PRESERVE_AS_CONSTRAINT_BACKING_INDEX: 32 (25 PK + 7 UNIQUE)
- PRESERVE_DURING_TRANSITION_AND_ADD_PARALLEL_TENANT_INDEX: 14 (índices user_id em tabelas tenant diretas)
- PRESERVE_UNCHANGED: 7 (FK/lookup sem user_id)
- REPLACE_AFTER_VALIDATED_TENANT_INDEX: 0
- REMOVE_ONLY_AFTER_VALIDATED_REPLACEMENT: 0
- POTENTIALLY_REDUNDANT_REQUIRES_PERFORMANCE_EVIDENCE: 0
- REQUIRES_F4_OR_LATER_OPERATIONAL_DECISION: 0
- OTHER_DOCUMENTED_DISPOSITION: 0

## 5. 11 índices ausentes — identificados
7 UNIQUE (cartoes_faturas_cartao_id_ano_mes_key, categorias_contas_pagar_user_id_nome_key, cvd_sale_unique, controle_vendas_fornecedor_user_id_mes_ano_key, payables_unique_pendente, payment_routing_rules_user_id_payment_method_key, user_roles_user_id_role_key) + 4 FK/lookup sem user_id (idx_aportes_financeiros_bank_account, idx_aportes_financeiros_customer, audit_log_row_idx, cartoes_lancamentos_cartao_fatura_idx). Todos RESOLVED_IN_F3_V1.

## 6. Reconciliação dos 34 índices futuros (soma primária = 34)
14 TENANT_SCOPE_FILTER_SUPPORT · 3 TENANT_COMPOSITE_UNIQUENESS · 3 TENANT_FOREIGN_KEY_JOIN_SUPPORT · 3 RLS_MEMBERSHIP_OR_PERMISSION_SUPPORT · 11 CANONICAL_ENTITY_SUPPORT.

## 7. Matriz atual → futuro
32 sem futuro (constraint-backing) · 14 com paralelo · 7 preserve unchanged · 17 futuros sem predecessor. Nenhuma substituição/remoção autorizada em F3.

## 8. PK/UNIQUE vs constraints
7 UNIQUE indexes vs 5 UNIQUE constraints: diferença = 2 UNIQUE parciais (não representáveis como constraint no PostgreSQL).

## 9. Batching de backfill (17 tabelas)
13 SINGLE_TRANSACTION_POTENTIALLY_ACCEPTABLE_PENDING_F4_PREFLIGHT · 4 UNKNOWN_REQUIRES_F4_CAPABILITY_AND_VOLUME_VALIDATION (compras, controle_vendas_diario, finance_entries, sales — cascatas de trigger elevam risco de lock).

## 10. Prontidão
F3 homologável. Elegível para F4. F4 não autorizada. Nenhuma precondição operacional (backup, restore, dry-run, janela, four-eyes, flags) concluída.

## 11. Não mutação
Zero migrations, zero SQL, zero alterações de banco/frontend/backend/publicação. 14 artefatos criados nesta V1.
