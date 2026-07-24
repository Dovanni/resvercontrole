# ROSE-ME-F1 — Constituição, Princípios, Arquitetura-Alvo e Governança do ROSÉ Multiempresa

**Framework:** ROSE-ME-F1 v1.0  
**Programa:** ROSE_NATIVE_MULTITENANCY_TRANSFORMATION_PROGRAM (RNMTP)  
**Aplicação-alvo:** GESTOR COMERCIAL E FINANCEIRO ROSÉ (resvercontrole.lovable.app)  
**Framework pai:** ROSE-ME-F0-V1  
**Natureza:** 100% documental, constitucional, read-only, fail-closed, zero mutation.

## 1. Precondições
- F0: 20 artefatos verificados, 612 checagens, 0 falhas, baseline `689af23fb305255932cf86b48d4774775877d4a65061528e11b61487192a9a39`.
- F0-V1: 12 artefatos verificados, 360 checagens, 0 falhas, F0 homologável, `documentary_f1_eligibility=ELIGIBLE`.

## 2. Declaração Constitucional
O ROSÉ será transformado de aplicação single-company em plataforma multiempresa nativa, segura, auditável e reversível, sob os pilares `DENY_BY_DEFAULT`, `LEAST_PRIVILEGE`, `VALIDATED_MEMBERSHIP`, `TENANT_ISOLATION`, `HUMAN_OVERSIGHT`, `AUDITABILITY`, `REVERSIBILITY`, `PRIVACY_BY_DESIGN`, `SECURITY_BY_DESIGN` e `ZERO_AUTOMATIC_HEADQUARTERS_FINANCIAL_ACCESS`.

## 3. Princípios Fundamentais (15)
- **P01 — ISOLAMENTO_EMPRESARIAL:** Cada registro empresarial possui escopo de tenant direto ou derivado por relacionamento seguro.
- **P02 — MENOR_PRIVILEGIO:** Cada membro terá somente as permissões necessárias à sua função.
- **P03 — NEGAR_POR_PADRAO:** A ausência de autorização explícita resulta em DENY.
- **P04 — EMPRESA_NAO_CONFIADA_AO_NAVEGADOR:** empresa_id enviado pelo cliente não é prova de autorização.
- **P05 — MEMBERSHIP_ATIVA_OBRIGATORIA:** Toda operação empresarial depende de vínculo ativo e validado.
- **P06 — PROTECAO_FINANCEIRA:** Dados financeiros são privados da empresa proprietária.
- **P07 — AUTONOMIA_EMPRESARIAL:** Cada empresa administra seus membros, dados, configurações e integrações.
- **P08 — SEDE_SEM_ACESSO_AUTOMATICO:** Administração central e METRIXHR não recebem acesso automático a dados comerciais ou financeiros.
- **P09 — AUDITORIA_PROPORCIONAL:** Ações relevantes produzem trilha sem registrar payloads sensíveis.
- **P10 — REVERSIBILIDADE:** Toda evolução estrutural possui rollback definido.
- **P11 — COMPATIBILIDADE:** Empresa atual e seus dados são preservados integralmente.
- **P12 — SUPERVISAO_HUMANA:** Ações administrativas e acessos excepcionais dependem de autoridade humana.
- **P13 — NAO_DISCRIMINACAO:** Nenhum algoritmo limita acesso com base em inferências pessoais ou atributos protegidos.
- **P14 — TRANSPARENCIA:** Usuários compreendem qual empresa está ativa e quais dados estão sendo administrados.
- **P15 — LGPD_MINIMIZACAO:** Coletar, processar e registrar somente o necessário.

## 4. Arquitetura-Alvo
`ROSE_NATIVE_SHARED_APPLICATION_ISOLATED_TENANT_DATA_ARCHITECTURE` — aplicação compartilhada, dados isolados por empresa, memberships por usuário×empresa, papéis por membership, permissões por papel, RLS obrigatória, Storage e integrações isolados, auditoria com contexto empresarial. **Definida, não implementada.**

## 5. Identidade Empresarial Canônica
Entidade conceitual `empresas` com atributos mínimos (id, nome_empresarial, nome_fantasia, documento_empresarial, status, modalidade, timezone, moeda, locale, timestamps, autoria, suspensão, encerramento). **Empresa canônica candidata:** *Angela Maria Momo Rodrigues MEI* (não criada, não associada).

## 6. Memberships, Papéis e Permissões
- `empresa_membros`: status {INVITED, ACTIVE, SUSPENDED, REMOVED, EXPIRED}.
- Papéis iniciais: OWNER, ADMIN, FINANCIAL, COMMERCIAL, OPERATOR, AUDITOR, VIEWER.
- Papéis de plataforma separados: PLATFORM_ADMIN, PLATFORM_SUPPORT (sem acesso automático a dados empresariais).
- Permissões catalogadas: 42.

## 7. Empresa Ativa e Contrato de Tenancy
Contexto ativo obrigatório, validado server-side; `empresa_id` no cliente nunca é prova. Todo objeto TENANT_SCOPED possui `empresa_id` direto ou relacionamento obrigatório com pai que o possua.

## 8. RLS Constitucional
Deny by default; policies por operação; SELECT/INSERT/UPDATE/DELETE dependem de membership ativa e permissão; `empresa_id` imutável em operação comum; SECURITY DEFINER excepcional; service_role proibida no navegador.

## 9. Onboarding, Convites e Offboarding
Fluxos transacionais definidos: INVITE_MEMBER, ACCEPT_INVITATION, CHANGE_MEMBER_ROLE, SUSPEND_MEMBER, REACTIVATE_MEMBER, REMOVE_MEMBER, TRANSFER_OWNERSHIP. Nenhuma execução autorizada nesta fase.

## 10. Storage, Integrações, Jobs e Auditoria
Padrão de path `empresa_id/modulo/recurso_id/arquivo`; integrações por empresa; jobs com tenant; entidade conceitual `empresa_audit_logs` com 13 campos.

## 11. Fronteiras e Ameaças
- Fronteiras: 15.
- Ameaças constitucionais avaliadas: 30.

## 12. Governança Humanizada e LGPD
Dignidade, privacidade, autonomia, transparência, acessibilidade, proporcionalidade, não discriminação, explicabilidade, supervisão humana, contestabilidade. Ownership definido; ownership não atribuído.

## 13. Migração e Rollback
Baseline financeira preservada `689af23fb305255932cf86b48d4774775877d4a65061528e11b61487192a9a39`. Migração futura conforme etapas documentadas; rollback obrigatório com kill switch e evidência de não regressão.

## 14. Roadmap
F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10. Nenhum gate iniciado automaticamente.

## 15. Decisão
- `readiness = READY_FOR_CANONICAL_MULTITENANCY_DATA_MODEL`
- `constitution_established = true`
- `F2_authorized = false`
- `implementation_authorized = false`

Status: `ROSE_ME_F1_CONSTITUTION_PRINCIPLES_TARGET_ARCHITECTURE_AND_GOVERNANCE_COMPLETED_AWAITING_EXPLICIT_AUTHORIZATION_FOR_ROSE_ME_F2`.
