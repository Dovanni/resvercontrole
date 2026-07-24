# ROSE-ME-F0 — Auditoria Read-Only, Baseline e Plano de Multiempresa

**Framework:** ROSE-ME-F0 v1.0
**Aplicação:** GESTOR COMERCIAL E FINANCEIRO ROSÉ ({})
**Ambiente:** CURRENT_OPERATIONAL_ROSE_APPLICATION (ROSE-CURRENT-01)
**Domínio:** resvercontrole.lovable.app
**Modo:** 100% documental, somente leitura, zero mutação, zero breaking changes.
**Gerado em:** 2026-07-24T21:26:53.765791Z

## 1. Estado atual (síntese)

- Arquitetura vigente: **SINGLE_COMPANY** (proprietário único, sem entidade empresa).
- Empresa canônica futura: **Angela Maria Momo Rodrigues MEI**.
- Escopo autoral atual: 25 tabelas em `public`, todas com RLS habilitada por `auth.uid() = user_id`.
- Nenhuma FK física detectada; integridade referencial é aplicada por triggers.

## 2. Inventário de aplicação

- Rotas em `src/routes/`: 28 arquivos.
- Componentes em `src/components/`: 10 arquivos.
- Módulos funcionais ativos: 25 (dashboard, BI, vendas, compras, contas a pagar/receber, financeiro, fluxo de caixa, balancete, despesas anuais, cartões, clientes, fornecedores, produtos, categorias, curva ABC, controle de vendas, relatórios, importar, configurações, auth).

## 3. Banco de dados — resumo por tabela

| Tabela | Linhas | Classificação | RLS |
|---|---:|---|---|
| aportes_financeiros | 0 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| audit_log | 802 | AUDIT_SCOPED | 1 policy (auth.uid=user_id) |
| bank_accounts | 12 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| bank_movements | 102 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| cartoes_credito | 6 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| cartoes_faturas | 8 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| cartoes_lancamentos | 111 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| categorias_contas_pagar | 79 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| company_settings | 1 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| compras | 2 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| compras_itens | 11 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| controle_vendas_diario | 17 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| controle_vendas_fornecedor | 5 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| controle_vendas_fornecedor_historico | 4 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| customers | 16 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| finance_entries | 94 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| payables | 307 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| payment_routing_rules | 84 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| products | 33 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| profiles | 7 | USER_SCOPED | 1 policy (auth.uid=user_id) |
| receivables | 11 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| sale_items | 65 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| sales | 11 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| suppliers | 42 | TENANT_SCOPED | 1 policy (auth.uid=user_id) |
| user_roles | 7 | MEMBERSHIP_SCOPED | 1 policy (auth.uid=user_id) |

## 4. Baseline comercial e financeira (BRL)

- Vendas entregues (total): **R$ 4.373,68** em 11 vendas.
- Contas a receber (total / recebido): **R$ 5.682,40 / R$ 2.861,40**.
- Contas a pagar (total / pago): **R$ 33.181,55 / R$ 6.543,57**.
- Saldo bancário (soma sinalizada de bank_movements): **R$ 5.583,03**.
- Movimentos bancários: 102 registros; 12 contas; 6 cartões.

## 5. Dependências de empresa única — top achados

- **CRITICAL**: 22 tabelas tenant-scoped sem `empresa_id`.
- **CRITICAL**: Frontend não possui contexto de empresa ativa; toda query depende de RLS por `user_id`.
- **HIGH**: Papéis (`user_roles`) e função `has_role()` são globais — admin é global, não por empresa.
- **HIGH**: 15+ triggers propagam `user_id` mas não `empresa_id`.
- **HIGH**: Constraints unique globais (`categorias_contas_pagar(user_id, nome)`, `payment_routing_rules(user_id, payment_method)`) colidirão entre empresas.
- **HIGH**: Storage sem prefixo empresa_id (`product-photos`, `company-logos`).
- **MEDIUM**: `handle_new_user()` executa provisionamento fixo (categorias, routing, MP) sem noção de empresa.

## 6. Plano preliminar de transformação

F1 Constituição → F2 Modelo canônico → F3 Migration/Backfill/Rollback → F4 Implementação estrutural → F5 Associação da empresa atual → F6 RLS composta → F7 UI empresa ativa → F8 Empresa sintética → F9 Testes de isolamento → F10 Liberação externa.

Ver `ROSE_ME_F0_MULTITENANCY_MIGRATION_ROLLBACK_AND_PHASED_ROADMAP.json` para o detalhamento por fase.

## 7. Rollback e proteção

- Kill switch documental: feature flag `multitenancy_active`.
- Baseline SHA-256 obrigatória antes de F5.
- Backfill idempotente vinculando 100% das linhas existentes à empresa canônica.

## 8. Prontidão para F1

**Classificação:** READY_FOR_MULTITENANCY_CONSTITUTION.
**Autorização de implementação:** NÃO — requer gate humano explícito para ROSE-ME-F1.

## 9. Evidências

Todos os inventários detalhados estão em `artifacts/rose_multiempresa/ROSE_ME_F0/*.json`. Nenhum arquivo funcional, migration, SQL, secret, configuração ou dado foi alterado.
