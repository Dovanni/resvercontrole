# Plan: Vejamais — Remediação Final Bloqueante da RPC Atômica de Vendas

Este plano visa endurecer a RPC de vendas, implementar idempotência persistente no banco de dados, e validar o fluxo com testes transacionais reais em ambiente de preview.

## Database

1.  **Esquema de Idempotência**: Criar uma migration para adicionar a coluna `idempotency_key` (TEXT) à tabela `public.sales`.
2.  **Constraint Única**: Adicionar um índice único `UNIQUE (empresa_id, idempotency_key)` em `public.sales` para garantir que a mesma tentativa de venda por empresa não seja duplicada.
3.  **Endurecimento da RPC**:
    *   Atualizar a função `public.rpc_registrar_venda` para incluir `SECURITY DEFINER`.
    *   Configurar `SET search_path = pg_catalog, public, pg_temp`.
    *   Utilizar nomes de tabelas qualificados (`public.sales`, `public.sale_items`, etc.).
    *   Validar `auth.uid()` e vínculo ativo em `public.user_company_access`.
    *   Validar que todas as referências (cliente, produtos, conta) pertencem ao mesmo `empresa_id`.
    *   Implementar o tratamento da `p_idempotency_key` com `ON CONFLICT (empresa_id, idempotency_key) DO NOTHING` ou verificação atômica.
4.  **Grants de Segurança**:
    *   `REVOKE ALL ON FUNCTION public.rpc_registrar_venda FROM PUBLIC, anon, service_role`.
    *   `GRANT EXECUTE ON FUNCTION public.rpc_registrar_venda TO authenticated`.

## Frontend

1.  **Gestão de Idempotência**:
    *   No componente `SalesPage` (`src/routes/_authenticated.vendas.tsx`), gerar uma `idempotencyKey` persistente enquanto o formulário estiver aberto.
    *   Manter a mesma chave em caso de retry (erro de rede, etc.).
    *   Renovar a chave apenas após sucesso, cancelamento ou mudança material no formulário.
2.  **Proteção de UI**:
    *   Garantir que o botão de envio seja desabilitado durante a execução da RPC.
    *   Exibir estado visual "Registrando...".
3.  **Tratamento de Erros**:
    *   Mapear erros do banco (como violação de unicidade) para mensagens amigáveis em português.

## Testes Transacionais

1.  Desenvolver um script de teste SQL que executa a matriz de 20 cenários (Venda à vista, a prazo, cross-tenant, falta de estoque, etc.).
2.  Cada teste será executado dentro de uma transação com `ROLLBACK` para garantir que o estado do banco permaneça inalterado (`ZERO_PERSISTENCE` após falhas simuladas).
3.  Reportar os resultados (Entrada/Esperado/Obtido/Status).

## Technical Details

- **Table**: `public.sales`
- **RPC**: `public.rpc_registrar_venda`
- **Idempotency**: `UUID v4` gerado no frontend e persistido via constraint única composta.
- **Security**: `SECURITY DEFINER` com `search_path` restrito para evitar ataques de search path hijacking.
- **Atomicidade**: Todas as mutações (sales, items, stock, finance) encapsuladas no bloco PL/pgSQL da RPC.
