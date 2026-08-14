DROP POLICY IF EXISTS "Enable all for authenticated" ON public.plans;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.empresas;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.sales;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.sale_items;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.products;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.customers;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.bank_accounts;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.user_company_access;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.rate_limits;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.pending_onboardings;
DROP POLICY IF EXISTS "Enable read for anon" ON public.plans;

-- Restabelecer GRANTs mínimos
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_access TO authenticated;

-- Garantir que policies Multiempresa e Proprietárias existam (já estão presentes conforme query anterior)
-- Ex: "own profile" na tabela profiles, "Multiempresa isolation" na bank_accounts, etc.

-- Corrigir user_roles para ser SECURITY DEFINER via has_role e não política permissiva
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Corrigir user_company_access
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own access" ON public.user_company_access;
CREATE POLICY "Users can see their own company access" ON public.user_company_access FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Corrigir rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated rate limits" ON public.rate_limits;
-- Apenas service_role deve gerenciar rate limits
GRANT ALL ON public.rate_limits TO service_role;
REVOKE ALL ON public.rate_limits FROM authenticated, anon, public;