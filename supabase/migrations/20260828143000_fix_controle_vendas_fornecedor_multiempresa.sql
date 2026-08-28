-- Correção definitiva do escopo multiempresa do fornecedor no Controle de Vendas

ALTER TABLE public.controle_vendas_fornecedor
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);

ALTER TABLE public.controle_vendas_fornecedor_historico
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);

UPDATE public.controle_vendas_fornecedor cvf
SET empresa_id = uca.empresa_id
FROM public.user_company_access uca
WHERE cvf.empresa_id IS NULL
  AND uca.user_id = cvf.user_id
  AND uca.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_company_access uca2
    WHERE uca2.user_id = cvf.user_id
      AND uca2.status = 'active'
      AND uca2.empresa_id <> uca.empresa_id
  );

UPDATE public.controle_vendas_fornecedor_historico cvfh
SET empresa_id = uca.empresa_id
FROM public.user_company_access uca
WHERE cvfh.empresa_id IS NULL
  AND uca.user_id = cvfh.user_id
  AND uca.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_company_access uca2
    WHERE uca2.user_id = cvfh.user_id
      AND uca2.status = 'active'
      AND uca2.empresa_id <> uca.empresa_id
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.controle_vendas_fornecedor WHERE empresa_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incompleto em controle_vendas_fornecedor: empresa_id nulo permanece';
  END IF;
  IF EXISTS (SELECT 1 FROM public.controle_vendas_fornecedor_historico WHERE empresa_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incompleto em controle_vendas_fornecedor_historico: empresa_id nulo permanece';
  END IF;
END $$;

ALTER TABLE public.controle_vendas_fornecedor
  ALTER COLUMN empresa_id SET NOT NULL;

ALTER TABLE public.controle_vendas_fornecedor_historico
  ALTER COLUMN empresa_id SET NOT NULL;

ALTER TABLE public.controle_vendas_fornecedor
  DROP CONSTRAINT IF EXISTS controle_vendas_fornecedor_user_id_mes_ano_key;

ALTER TABLE public.controle_vendas_fornecedor
  ADD CONSTRAINT controle_vendas_fornecedor_empresa_id_mes_ano_key
  UNIQUE (empresa_id, mes, ano);

CREATE INDEX IF NOT EXISTS idx_controle_vendas_fornecedor_empresa_id
  ON public.controle_vendas_fornecedor (empresa_id);

CREATE INDEX IF NOT EXISTS idx_controle_vendas_fornecedor_historico_empresa_id_mes_ano
  ON public.controle_vendas_fornecedor_historico (empresa_id, ano, mes);

ALTER TABLE public.controle_vendas_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_vendas_fornecedor_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rows" ON public.controle_vendas_fornecedor;
DROP POLICY IF EXISTS "Users manage own fornecedor historico" ON public.controle_vendas_fornecedor_historico;
DROP POLICY IF EXISTS "Multiempresa isolation" ON public.controle_vendas_fornecedor;
DROP POLICY IF EXISTS "Multiempresa isolation" ON public.controle_vendas_fornecedor_historico;

CREATE POLICY "Multiempresa isolation"
ON public.controle_vendas_fornecedor
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.empresa_id = controle_vendas_fornecedor.empresa_id
      AND uca.user_id = auth.uid()
      AND uca.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.empresa_id = controle_vendas_fornecedor.empresa_id
      AND uca.user_id = auth.uid()
      AND uca.status = 'active'
  )
);

CREATE POLICY "Multiempresa isolation"
ON public.controle_vendas_fornecedor_historico
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.empresa_id = controle_vendas_fornecedor_historico.empresa_id
      AND uca.user_id = auth.uid()
      AND uca.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.empresa_id = controle_vendas_fornecedor_historico.empresa_id
      AND uca.user_id = auth.uid()
      AND uca.status = 'active'
  )
);
