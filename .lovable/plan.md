# Plano de Correção: Cadastro de Compras Atômico e Multiempresa

Corrigir a falha de persistência do `empresa_id` na tabela `compras` através da implementação de uma RPC transacional, garantindo isolamento total e atomicidade no registro de compras, itens, estoque e parcelas financeiras.

## Etapa 1: Infraestrutura de Banco de Dados (RPC)
Criar a função `rpc_registrar_compra` para centralizar a lógica no servidor:
- **Segurança**: Validação rigorosa de `auth.uid()` e `empresa_id` (via `check_current_user_is_active_member`).
- **Integridade**: Validação de referências (fornecedor e produtos) contra o `empresa_id` fornecido.
- **Atomicidade**: Inserção coordenada em `compras`, `compras_itens` e `payables`, além da atualização de estoque em `products`, tudo dentro de uma transação SQL.
- **Fail-Closed**: Rollback automático em qualquer erro de validação ou restrição.

## Etapa 2: Refatoração do Frontend
Atualizar o componente `NovaCompraDialog` em `src/routes/_authenticated.compras.tsx`:
- **Consumo da RPC**: Substituir os múltiplos `supabase.insert` paralelos pela chamada única `supabase.rpc('rpc_registrar_compra', ...)`.
- **Propagação de Contexto**: Garantir que o `empresa_id` venha exclusivamente do hook `useMultiempresa` autenticado.
- **UX/Resiliência**: Melhorar o tratamento de erros e exibir mensagens amigáveis ao usuário, mantendo a integridade visual da plataforma.

## Etapa 3: Validação Forense (Provas T01-T15)
- Executar bateria de testes no Preview para confirmar:
    - Registro bem-sucedido com empresa ativa.
    - Bloqueio imediato de tentativas cross-tenant (produtos/fornecedores de outras empresas).
    - Inexistência de persistência parcial em caso de erro.
    - Correta propagação do `empresa_id` em todas as tabelas derivadas.

## Detalhes Técnicos
- **Ficheiros afetados**:
    - `supabase/migrations/[TIMESTAMP]_rpc_registrar_compra.sql`
    - `src/routes/_authenticated.compras.tsx`
- **Protocolo de Erro**: Conversão de exceções SQL em mensagens legíveis como "Não foi possível registrar a compra. Confirme a empresa ativa e tente novamente."
