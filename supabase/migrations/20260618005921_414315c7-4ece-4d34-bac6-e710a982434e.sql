
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fornecedor_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  numero_nf text,
  condicao_pagamento text NOT NULL DEFAULT 'a_vista',
  forma_pagamento text,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  parcelas integer NOT NULL DEFAULT 1,
  dia_vencimento integer,
  data_vencimento date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  frete numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  status text NOT NULL DEFAULT 'confirmada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own compras" ON public.compras FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER compras_updated_at BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.compras_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantidade numeric(12,3) NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_itens TO authenticated;
GRANT ALL ON public.compras_itens TO service_role;
ALTER TABLE public.compras_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own compras_itens" ON public.compras_itens FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX compras_user_idx ON public.compras(user_id, data_compra DESC);
CREATE INDEX compras_itens_compra_idx ON public.compras_itens(compra_id);
