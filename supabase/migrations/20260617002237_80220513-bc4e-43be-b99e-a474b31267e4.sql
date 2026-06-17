
CREATE TABLE public.controle_vendas_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  loja numeric(12,2) NOT NULL DEFAULT 0,
  custo numeric(12,2) NOT NULL DEFAULT 0,
  juros_ml numeric(12,2) NOT NULL DEFAULT 0,
  frete_empresa numeric(12,2) NOT NULL DEFAULT 0,
  frete_cliente numeric(12,2) NOT NULL DEFAULT 0,
  receber numeric(12,2) NOT NULL DEFAULT 0,
  rateio numeric(12,2) NOT NULL DEFAULT 0,
  lucro numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_vendas_diario TO authenticated;
GRANT ALL ON public.controle_vendas_diario TO service_role;
ALTER TABLE public.controle_vendas_diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.controle_vendas_diario FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_updated_at_cvd BEFORE UPDATE ON public.controle_vendas_diario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_cvd_user_mes_ano ON public.controle_vendas_diario(user_id, ano, mes);

CREATE TABLE public.controle_vendas_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  valor_fornecedor numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes, ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_vendas_fornecedor TO authenticated;
GRANT ALL ON public.controle_vendas_fornecedor TO service_role;
ALTER TABLE public.controle_vendas_fornecedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.controle_vendas_fornecedor FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_updated_at_cvf BEFORE UPDATE ON public.controle_vendas_fornecedor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
