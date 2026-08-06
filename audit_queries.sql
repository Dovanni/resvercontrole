SELECT 'null_empresa_id_count' as metric, SUM(count) as total FROM (
  SELECT count(*) FROM public.aportes_financeiros WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.bank_accounts WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.bank_movements WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.cartoes_credito WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.cartoes_faturas WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.cartoes_lancamentos WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.categorias_contas_pagar WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.compras WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.compras_itens WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.customers WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.payables WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.products WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.receivables WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.sale_items WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.sales WHERE empresa_id IS NULL UNION ALL
  SELECT count(*) FROM public.suppliers WHERE empresa_id IS NULL
) s;

SELECT 'orphan_empresa_id_count' as metric, count(*) FROM (
  SELECT empresa_id FROM public.payables EXCEPT SELECT id FROM public.empresas
) s;

SELECT 'users_without_company_membership' as metric, count(*) FROM auth.users u
LEFT JOIN public.user_company_access a ON u.id = a.user_id
WHERE a.id IS NULL;

SELECT 'duplicate_company_membership_count' as metric, count(*) FROM (
  SELECT user_id, empresa_id FROM public.user_company_access GROUP BY user_id, empresa_id HAVING count(*) > 1
) s;
