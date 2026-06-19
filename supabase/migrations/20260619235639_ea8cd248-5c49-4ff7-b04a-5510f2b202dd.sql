CREATE TABLE IF NOT EXISTS public.aportes_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  bank_movement_id uuid REFERENCES public.bank_movements(id) ON DELETE SET NULL,
  aporte_type text NOT NULL DEFAULT 'investidor',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'recebido',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aportes_financeiros TO authenticated;
GRANT ALL ON public.aportes_financeiros TO service_role;

ALTER TABLE public.aportes_financeiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own financial contributions" ON public.aportes_financeiros;
CREATE POLICY "Users can manage own financial contributions"
ON public.aportes_financeiros
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_aportes_financeiros_updated_at ON public.aportes_financeiros;
CREATE TRIGGER set_aportes_financeiros_updated_at
BEFORE UPDATE ON public.aportes_financeiros
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_aportes_financeiros_user_date ON public.aportes_financeiros(user_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_aportes_financeiros_customer ON public.aportes_financeiros(customer_id);
CREATE INDEX IF NOT EXISTS idx_aportes_financeiros_bank_account ON public.aportes_financeiros(bank_account_id);