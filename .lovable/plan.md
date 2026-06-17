## Módulo Contas Bancárias

Vou implementar em 4 etapas, na ordem:

### 1. Banco de dados (migration)
- `bank_accounts` (nome, banco, tipo, agência, conta, saldo_inicial, cor, status)
- `bank_movements` (conta_id, data, tipo entrada|saida|transferencia, categoria, descricao, valor, conta_destino_id, origem manual|receivable|payable, referencia_id, observacoes)
- Adicionar `bank_account_id` em `payables` e `receivables`
- RLS scoped to `auth.uid()` + GRANTs (authenticated/service_role)
- Triggers: ao marcar `payables.status='pago'` ou aumentar `receivables.received_amount`, inserir automaticamente em `bank_movements` se `bank_account_id` informado (origem=payable/receivable)
- View ou função para saldo atual = saldo_inicial + Σ entradas − Σ saídas (+ transferências in − out)

### 2. Página `/contas-bancarias`
- Rota `_authenticated.contas-bancarias.tsx`
- Cards por conta ativa (com cor, banco, saldo atual). Click → drawer/modal de extrato
- CRUD modal de contas (criar/editar/inativar)
- Extrato: filtros (período/categoria/tipo), tabela com saldo acumulado, botão "Nova movimentação" (form com tipo, categoria condicional, conta_destino quando transferência)
- Transferência cria 2 movimentos vinculados (saída origem + entrada destino)

### 3. Integração contas a pagar/receber
- Adicionar select "Conta bancária" no fluxo "marcar como pago" em `contas-pagar.tsx`
- Adicionar select "Conta bancária" no fluxo "marcar como recebido" em `contas-receber.tsx`
- Persistir `bank_account_id` no registro; trigger DB cria a movimentação

### 4. Fluxo de caixa + Relatórios + Menu
- Atualizar `fluxo-caixa.tsx`: filtro por conta, saldo total consolidado, série temporal por conta
- Aba "Bancário" em `relatorios.tsx`: posição por conta, total consolidado, movimentações por categoria, export Excel
- Adicionar item no menu lateral entre Financeiro e Relatórios, ícone `Landmark` (lucide — substituto de `ti-building-bank`)

### Detalhes técnicos
- Stack já existente: TanStack Start + Supabase + shadcn + xlsx
- Cores das contas: paleta fixa de 8 opções (rosa, roxo, azul, verde, âmbar, ciano, índigo, fúcsia) — mantém harmonia com tema Rosé
- Saldo calculado client-side via query agregada (sum por tipo), evitando view materializada
- Entradas verde / saídas vermelho / transferências azul, saldo negativo destacado
