REVOKE EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid,jsonb,rpc_purchase_item_input[],rpc_purchase_payable_input[],text) TO service_role;
