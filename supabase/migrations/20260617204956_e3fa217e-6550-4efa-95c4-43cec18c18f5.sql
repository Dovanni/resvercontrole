CREATE TABLE public.controle_vendas_fornecedor_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  valor_anterior numeric(14,2) NOT NULL DEFAULT 0,
  valor_novo numeric(14,2) NOT NULL DEFAULT 0,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_vendas_fornecedor_historico TO authenticated;
GRANT ALL ON public.controle_vendas_fornecedor_historico TO service_role;
ALTER TABLE public.controle_vendas_fornecedor_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fornecedor historico"
  ON public.controle_vendas_fornecedor_historico
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_cvfh_user_mes_ano ON public.controle_vendas_fornecedor_historico(user_id, ano, mes, created_at DESC);