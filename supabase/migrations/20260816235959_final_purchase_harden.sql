-- Harden RPC and Idempotency
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
DROP INDEX IF EXISTS public.compras_empresa_idempotency_idx;
CREATE UNIQUE INDEX compras_empresa_idempotency_idx ON public.compras (empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

REVOKE EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) TO service_role;
