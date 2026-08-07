ALTER TABLE public.controle_vendas_diario ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Backfill: associar ao dono via sale_id -> sales -> empresa_id
UPDATE public.controle_vendas_diario cvd
SET empresa_id = s.empresa_id
FROM public.sales s
WHERE cvd.sale_id = s.id
AND cvd.empresa_id IS NULL;

-- Fallback para quem não tem sale_id (lançamentos manuais ou orfãos): usa a empresa do user_id
UPDATE public.controle_vendas_diario cvd
SET empresa_id = e.id
FROM public.empresas e
WHERE cvd.user_id = e.owner_id
AND cvd.empresa_id IS NULL;

-- Garantir NOT NULL
ALTER TABLE public.controle_vendas_diario ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_controle_vendas_diario_empresa_id ON public.controle_vendas_diario (empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_vendas_diario TO authenticated;
GRANT ALL ON public.controle_vendas_diario TO service_role;

ALTER TABLE public.controle_vendas_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Multiempresa isolation" ON public.controle_vendas_diario;
CREATE POLICY "Multiempresa isolation" ON public.controle_vendas_diario FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_company_access.empresa_id = controle_vendas_diario.empresa_id 
        AND user_company_access.user_id = auth.uid()
    )
);