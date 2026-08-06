-- VMEAP WAVE B: ADICIONAR EMPRESA_ID A FINANCE_ENTRIES E OUTRAS FALTANTES
DO $$
DECLARE
    t_name TEXT;
    tables_to_migrate TEXT[] := ARRAY['finance_entries']; -- Adicionando finance_entries que faltou no dashboard
BEGIN
    FOREACH t_name IN ARRAY tables_to_migrate LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = t_name AND column_name = 'empresa_id'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN empresa_id UUID REFERENCES public.empresas(id)', t_name);
            
            -- Backfill simples baseado no user_id se já houver empresa
            EXECUTE format('
                UPDATE public.%I t
                SET empresa_id = (SELECT id FROM public.empresas WHERE owner_id = t.user_id LIMIT 1)
                WHERE empresa_id IS NULL
            ', t_name);
            
            -- Se ainda houver nulos, define NOT NULL falhará, então garantimos que todos tenham empresa_id
            -- Mas na Wave A já criamos empresas para todos os donos de bank_accounts.
            
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN empresa_id SET NOT NULL', t_name);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (empresa_id)', 'idx_' || t_name || '_empresa_id', t_name);
            
            -- RLS
            EXECUTE format('DROP POLICY IF EXISTS "Multiempresa isolation" ON public.%I', t_name);
            EXECUTE format('CREATE POLICY "Multiempresa isolation" ON public.%I FOR ALL TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM public.user_company_access 
                    WHERE user_company_access.empresa_id = %I.empresa_id 
                    AND user_company_access.user_id = auth.uid()
                )
            )', t_name, t_name);
        END IF;
    END LOOP;
END $$;
