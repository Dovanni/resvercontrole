-- Kardex: grant read access to authenticated users.
-- Row-level isolation remains enforced by stock_movements_select_active_company.
GRANT SELECT ON TABLE public.stock_movements TO authenticated;
