# Plano de Correção: Fluxo Atômico de Vendas e Propagação de empresa_id

Este plano visa corrigir o erro de violação de restrição `NOT NULL` em `bank_movements.empresa_id` durante o registro de vendas, tornando o processo atômico através de uma RPC (Remote Procedure Call) e garantindo a propagação correta do tenant em todas as tabelas envolvidas.

## User-facing changes
- O registro de vendas será mais robusto e rápido.
- Erros parciais (ex: venda criada mas itens não registrados) serão eliminados.
- Mensagens de erro mais precisas em português.

## Technical details

### 1. Auditoria Forense (FASE 1 & 2)
- **Causa Raiz**: O frontend executa múltiplas inserções (sales -> sale_items). Triggers em `sales` disparam funções como `sale_status_to_finance` e `create_receivable_for_sale`. Essas funções ou omitiam o `empresa_id` ou falhavam ao resolver o tenant para registros dependentes em `bank_movements`.
- **Status da Tentativa**: Classificada como `ZERO_PERSISTENCE`. Nenhuma venda, item ou movimento foi encontrado com os valores informados (R$ 376,14), confirmando que a violação da restrição impediu a persistência.

### 2. Implementação do Banco de Dados (FASE 3 & 4)
- **Migration**: Criar `supabase/migrations/20260814000000_rpc_registrar_venda_atomica.sql`.
- **Conteúdo da Migration**:
    - Atualizar `sale_status_to_finance`, `create_receivable_for_sale`, `create_finance_for_sale` e `decrement_stock_on_sale_item` para garantir a propagação obrigatória de `empresa_id`.
    - Implementar a RPC `public.rpc_registrar_venda` que aceita os dados da venda e uma lista de itens em uma única transação.
    - Incluir validações de segurança: o `empresa_id` deve ser validado contra o contexto do usuário (`user_company_access`).
    - Garantir que `bank_account_id`, `customer_id` e `product_id` pertençam à mesma empresa.

### 3. Implementação do Frontend (FASE 7)
- **Arquivo**: `src/routes/_authenticated.vendas.tsx`.
- **Mudança**: Substituir o fluxo de múltiplas mutações no hook `submit` por uma única chamada `supabase.rpc('rpc_registrar_venda', { ... })`.
- **Idempotência**: Implementar um `idempotency_key` básico (UUID gerado no clique) para evitar duplicidade em cliques duplos.

### 4. Validação (FASE 5)
- Testar fluxos de venda à vista (movimento bancário imediato).
- Testar fluxos de venda a prazo (criação de recebível).
- Validar que falhas em qualquer etapa (ex: estoque insuficiente) revertem toda a operação.
- Verificar se o `empresa_id` está presente em todas as tabelas: `sales`, `sale_items`, `bank_movements`, `finance_entries`, `receivables`.

---
**Nota de Segurança**: Não será permitida a criação de vendas para empresas onde o usuário não possua vínculo `active`.
