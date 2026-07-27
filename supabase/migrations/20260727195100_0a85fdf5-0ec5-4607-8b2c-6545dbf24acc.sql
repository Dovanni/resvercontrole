REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM sandbox_exec';
  END IF;
END $$;
COMMENT ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb)
  IS 'TEMPORARIAMENTE DESABILITADA — bug SQLSTATE 0A000 (FOR UPDATE + aggregate). EXECUTE revogado de todas as roles de aplicação. Não usar até nova correção.';