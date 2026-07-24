# ROSE-ME-F0-V1 — Reconciliação Corretiva de Lacunas de Evidência, Índices, Constraints e Classificação Final

**Framework:** ROSE-ME-F0-V1 v1.0 (parent ROSE-ME-F0)
**Alvo:** GESTOR COMERCIAL E FINANCEIRO ROSÉ — resvercontrole.lovable.app (ROSE-CURRENT-01)
**Natureza:** 100% documental, somente leitura, corretiva, zero mutation, zero breaking changes.
**Gerado em:** 2026-07-24

## 1. Precondição F0

Os 20 artefatos originais da ROSE-ME-F0 estão preservados e imutáveis. Nenhum foi modificado nesta V1.

## 2. Inconsistências corrigidas

### 2.1 database_indexes_found = -1 (IMPOSSIBLE_NEGATIVE_OBJECT_COUNT)

Reconciliado por leitura direta de `pg_index`/`pg_indexes` no schema `public`:

- indexes_total: **53**
- primary_key_indexes: 25
- unique_indexes (não-PK): 7
- non_unique_indexes: 21
- partial_indexes: 2
- expression_indexes: 0
- composite_indexes: 19
- single_column_indexes: 34
- invalid_indexes: 0

**Causa do -1 na F0:** valor sentinela emitido pelo coletor original quando a consulta ao catálogo não foi executada (campo não instrumentado). A leitura corretiva desta V1 confirma que o catálogo está acessível e a contagem real é 53.

### 2.2 database_constraints_found = 0

Reconciliado por leitura de `pg_constraint`:

- constraints_total: **100**
- primary_key_constraints: 25
- foreign_key_constraints: 47
- unique_constraints: 5
- check_constraints: 23
- exclusion_constraints: 0
- not_null_columns (separado): 208

**Nota:** O valor 0 declarado na F0 foi um sub-registro do coletor (mesmo padrão de não-instrumentação da consulta ao catálogo). A ROSE-ME-F0 declarou em `SCD-005` "Nenhuma FK física detectada" — esta afirmação é **incorreta** e fica formalmente registrada como lacuna material corrigida nesta V1: existem 47 FKs físicas ativas no `public`, todas validadas.

### 2.3 Duas lacunas declaradas (evidence_gaps_found = 2)

Identificadas nominalmente:

- **GAP-01**: contagem de índices não instrumentada (valor sentinela -1). Materialidade: MATERIAL_BUT_NOT_BLOCKING_F1. Estado: **RESOLVED_IN_V1**.
- **GAP-02**: contagem de constraints e existência de FKs físicas subestimada (0). Materialidade: MATERIAL_BUT_NOT_BLOCKING_F1 (impacta o mapa de relacionamentos e a estratégia de rollback, mas não invalida o roadmap documental). Estado: **RESOLVED_IN_V1**.

## 3. Relacionamentos — enforcement real

47 FKs físicas em `public` (todas `convalidated=true`). Ações predominantes: `ON DELETE CASCADE` para pertencimento a `user_id`/parent, `SET NULL` para vínculos opcionais (`customer_id`, `supplier_id`, `bank_account_id`, `sale_id` em receivables/CVD). Duas FKs com `ON DELETE RESTRICT` (`sale_items.product_id`, `compras_itens.produto_id`) protegem histórico de vendas/compras contra remoção de produto.

Integridade referencial é, portanto, **DATABASE_ENFORCED_FOREIGN_KEY** — não apenas por trigger/aplicação como a F0 concluíra.

## 4. Baseline preservada

Nenhum recálculo comercial/financeiro. `baseline_sha256` original preservado.

## 5. Decisão

- readiness: **READY_FOR_MULTITENANCY_CONSTITUTION**
- F0_homologable: **true** (após esta reconciliação corretiva)
- F1: **não autorizada** — depende de gate humano explícito.

## 6. Não mutação

Nenhuma alteração em código, banco, RLS, Auth, Storage, Edge Functions, secrets, publicação ou artefatos originais. Apenas 12 novos arquivos documentais criados.
