# VEJAMAIS-ME-F4-OPR-H1-R4 — Single-Operator Compensating Controls and Dual-Control Activation Plan

**Framework:** VEJAMAIS-ME-F4-OPR-H1-R4 v1.0
**Parent:** VEJAMAIS-ME-F4-OPR-H1-R2-R2
**Legacy reference:** ROSE-ME-F4-OPR-H1-R4
**Program:** VNMTP
**Environment:** ROSE-CURRENT-01
**Nature:** 100% documental, zero mutação, fail-closed.

## 1. Autorização humana

`human_authorization_received = true`, escopo restrito a **planejamento de
ativação** dos 18 controles compensatórios (SOCC-01..SOCC-18) e do modelo
**Single-Operator Dual-Control** (DC-01..DC-12). Nenhuma configuração,
teste real, código, migration, backup, restore, backfill, rollback,
publicação, dry-run ou acesso a dados de tenants.

## 2. Operador único canônico

- HUMAN-SO-01 — Antonio Roberto Rodrigues
- `single_operator_final_authority_preserved = true`
- `second_person_dependency_created = false`
- `third_party_dependency_created = false`
- `human_independence_claimed = false`
- `automation_supports_but_does_not_replace_human_accountability = true`
- `controls_protect_autonomy_without_removing_authority = true`

## 3. Precondição de gate pai

`parent_final_evidence_manifest_sha256 = dfbdf6a4c0517e9807dfd7b083d62ac571984297165b80bd1c303fa2c7a8991d`
e `baseline_sha256 = 689af23fb305255932cf86b48d4774775877d4a65061528e11b61487192a9a39`
preservados. `baseline_changed = false`.

## 4. Modelo Single-Operator Dual-Control (12 estágios)

DC-01 SCOPE_DECLARATION · DC-02 RISK_CLASSIFICATION · DC-03
PRECONDITION_VALIDATION · DC-04 ISOLATED_IMPLEMENTATION · DC-05
AUTOMATED_VERIFICATION · DC-06 PACKAGE_FREEZE · DC-07
TEMPORAL_REVIEW_PAUSE · DC-08 SECOND_MOMENT_HUMAN_REVIEW · DC-09
EXPLICIT_FINAL_AUTHORIZATION · DC-10 CONTROLLED_EXECUTION · DC-11
POST_EXECUTION_VALIDATION · DC-12 ROLLBACK_OR_HOMOLOGATION.

`same_session_preparation_and_critical_publication_allowed = false`,
`package_change_after_authorization_allowed = false`,
`revalidation_after_package_change_required = true`.

## 5. Classificação de risco

LOW, MEDIUM, HIGH, CRITICAL, EXTREME. Separação temporal proporcional ao
risco, sem duração fixa arbitrária. EXTREME pode exigir revisão externa
pontual (SOCC-18).

## 6. Estados dos controles

DEFINED → PLANNED → CONFIGURED → TESTED_PASS/TESTED_FAIL → OPERATIONAL →
SUSPENDED → RETIRED. Neste gate: **DEFINED → PLANNED** para os 18
controles. Nenhum passa a CONFIGURED/TESTED/OPERATIONAL.

## 7. Catálogo SOCC-01..SOCC-18

Escopo/risco (01), separação temporal (02), pacote imutável com hash
(03), verificação automatizada (04), validação de schema/RLS/tenant
(05), backup (06), restore (07), feature flag (08), kill switch (09),
rollback (10), evidência imutável (11), não regressão financeira (12),
comparação pré/pós (13), fail-closed (14), autorização separada para
migration (15), backfill (16), produção (17), revisão externa em risco
extremo (18). Cada um com objetivo, configuração futura, teste futuro,
resultado esperado e evidência mínima definidos.

## 8. Matriz de aplicabilidade mínima

- LOW: 01, 02, 03, 04, 13, 14, 17
- MEDIUM: LOW + 10, 11
- HIGH: MEDIUM + 05, 06, 08, 09, 12
- CRITICAL: HIGH + 07, 15, 16
- EXTREME: CRITICAL + 18

Aplicabilidade final depende da natureza real da mudança.

## 9. Evidência mínima por controle

`control_id, version, status, change_package_id, environment,
tenant_scope, risk_level, responsible_operator, configured_at,
tested_at, test_result, evidence_reference, evidence_sha256,
failure_reason, rollback_reference, expiration_or_review_date,
independent_automation_result, final_human_authorization_id`. Sem
dados privados ou payloads sensíveis desnecessários.

## 10. Plano de testes

LEVEL-1 DOCUMENTARY_TEST = PLANNED · LEVEL-2 SYNTHETIC_DRY_RUN =
NOT_AUTHORIZED · LEVEL-3 CONTROLLED_OPERATIONAL_VALIDATION =
NOT_AUTHORIZED. Nenhum teste real neste gate.

## 11. Ambiente isolado (planejado)

Identidade própria, dados sintéticos, sem dados reais de tenants, sem
secrets de produção, sem integração financeira real, sem service_role
no navegador, logs segregados, descartável, rollback seguro, baseline
próprio. `test_environment_required = true`,
`test_environment_defined = false`.

## 12. Proteção multiempresa

Testes futuros deverão provar isolamento absoluto A↔B em leitura,
escrita, export, realtime, cache, relatórios; tenant_id do navegador
não confiável; membership e role validadas no banco; RLS deny-by-default;
platform owner sem acesso privado automático; suporte excepcional
escopado e auditado.

## 13. Proteção LGPD

Minimização, finalidade, retenção, consentimento quando aplicável,
transparência, direitos dos titulares, exportação restrita, exclusão
controlada, anonimização quando aplicável, segurança de logs/backups,
incident response, suporte temporário. `LGPD_test_plan_defined = true`,
`privacy_controls_operational = false`.

## 14. Autonomia de Antonio

Antonio planeja, desenvolve, revisa, autoriza, executa, interrompe,
publica, homologa e determina rollback, desde que os controles
obrigatórios aplicáveis estejam satisfeitos. Controles protegem, não
substituem, sua autoridade.

## 15. Gates futuros

R5 CONFIGURATION_PACKAGE_DESIGN · R6 ISOLATED_IMPLEMENTATION_AUTHORIZATION
· R7 SYNTHETIC_DRY_RUN_VALIDATION · R8 OPERATIONAL_READINESS_DECISION.
Cada gate exige autorização humana explícita.

## 16. Precondicionantes preservadas

OP-05 BLOCKED_PENDING_FUTURE_SINGLE_OPERATOR_EXPLICIT_WINDOW_AUTHORIZATION,
OP-06 SATISFIED_DOCUMENTALLY_ONLY, OP-07
SUPERSEDED_BY_SINGLE_OPERATOR_DUAL_CONTROL_NOT_YET_OPERATIONAL,
OP-12/13/14/15 BLOCKED_NOT_GRANTED.

## 17. Estado da F4

`F4_authorized = false`, `F4_started = false`,
`development_authorized = false`, `isolated_implementation_authorized
= false`, `dry_run_authorized = false`, `SQL_authorized = false`,
`migration_authorized = false`, `backfill_authorized = false`,
`production_authorized = false`, `project_publication_authorized =
false`.

## 18. Não mutação

Banco, aplicação, tenants, usuários, dados financeiros/comerciais,
Auth, RLS, Storage, integrações, secrets, domínio inalterados.
`migrations_created = 0`, `rows_inserted/updated/deleted = 0`,
`project_published = false`, `previous_artifacts_modified = 0`,
`previous_hashes_changed = 0`.

## 19. Decisão

**VEJAMAIS_ME_SINGLE_OPERATOR_COMPENSATING_CONTROLS_AND_DUAL_CONTROL_ACTIVATION_PLAN_ESTABLISHED**

Classificação: `VEJAMAIS_MULTIEMPRESA_SINGLE_OPERATOR_CONTROL_MODEL_FULLY_PLANNED_WITH_AUTONOMY_PRESERVED_TENANT_ISOLATION_LGPD_AND_NO_TECHNICAL_EXECUTION`.

Próximo gate: **VEJAMAIS-ME-F4-OPR-H1-R5** — Single-Operator Compensating
Control Configuration Package Design (requer autorização humana
explícita).
