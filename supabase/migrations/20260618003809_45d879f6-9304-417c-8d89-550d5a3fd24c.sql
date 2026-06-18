
CREATE TABLE public.cartoes_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  bandeira text NOT NULL,
  limite_total numeric(14,2) NOT NULL DEFAULT 0,
  dia_vencimento integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  dia_fechamento integer NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  cor text NOT NULL DEFAULT '#7c3aed',
  conta_bancaria_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_credito TO authenticated;
GRANT ALL ON public.cartoes_credito TO service_role;
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cartoes" ON public.cartoes_credito FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_cartoes_credito_updated BEFORE UPDATE ON public.cartoes_credito FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cartoes_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id uuid NOT NULL REFERENCES public.cartoes_credito(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('combustivel','casa','pessoal')),
  valor numeric(14,2) NOT NULL,
  parcelado boolean NOT NULL DEFAULT false,
  total_parcelas integer NOT NULL DEFAULT 1,
  parcela_atual integer NOT NULL DEFAULT 1,
  grupo_parcela uuid,
  mes_fatura integer NOT NULL,
  ano_fatura integer NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_lancamentos TO authenticated;
GRANT ALL ON public.cartoes_lancamentos TO service_role;
ALTER TABLE public.cartoes_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cartoes_lancamentos" ON public.cartoes_lancamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_cartoes_lancamentos_updated BEFORE UPDATE ON public.cartoes_lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX cartoes_lancamentos_cartao_fatura_idx ON public.cartoes_lancamentos(cartao_id, ano_fatura, mes_fatura);

CREATE TABLE public.cartoes_faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id uuid NOT NULL REFERENCES public.cartoes_credito(id) ON DELETE CASCADE,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta',
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cartao_id, ano, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_faturas TO authenticated;
GRANT ALL ON public.cartoes_faturas TO service_role;
ALTER TABLE public.cartoes_faturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cartoes_faturas" ON public.cartoes_faturas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_cartoes_faturas_updated BEFORE UPDATE ON public.cartoes_faturas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
