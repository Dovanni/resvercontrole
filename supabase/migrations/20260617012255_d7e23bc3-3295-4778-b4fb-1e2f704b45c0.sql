
-- 1. bank_accounts
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank text NOT NULL,
  account_type text NOT NULL DEFAULT 'corrente' CHECK (account_type IN ('corrente','poupanca','digital')),
  agency text,
  account_number text,
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#ec4899',
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','inativa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_accounts_user_idx ON public.bank_accounts(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bank_accounts" ON public.bank_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. bank_movements
CREATE TABLE public.bank_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  movement_date date NOT NULL DEFAULT (now()::date),
  type text NOT NULL CHECK (type IN ('entrada','saida','transferencia')),
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  destination_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','payable','receivable','transfer')),
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_movements_user_idx ON public.bank_movements(user_id, account_id, movement_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_movements TO authenticated;
GRANT ALL ON public.bank_movements TO service_role;
ALTER TABLE public.bank_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bank_movements" ON public.bank_movements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER bank_movements_updated_at BEFORE UPDATE ON public.bank_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Add bank_account_id to payables/receivables
ALTER TABLE public.payables ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.receivables ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- 4. Auto-create bank movement when payable paid
CREATE OR REPLACE FUNCTION public.payable_to_bank_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sup_name text;
BEGIN
  IF NEW.status = 'pago'
     AND (OLD.status IS DISTINCT FROM 'pago')
     AND NEW.bank_account_id IS NOT NULL
  THEN
    SELECT name INTO sup_name FROM public.suppliers WHERE id = NEW.supplier_id;
    INSERT INTO public.bank_movements
      (user_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
    VALUES (
      NEW.user_id,
      NEW.bank_account_id,
      COALESCE(NEW.paid_at::date, now()::date),
      'saida',
      NEW.category,
      COALESCE(sup_name || ' — ', '') || NEW.description,
      COALESCE(NEW.paid_amount, NEW.amount),
      'payable',
      NEW.id
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER payables_to_bank AFTER UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.payable_to_bank_movement();

-- 5. Auto-create bank movement when receivable received
CREATE OR REPLACE FUNCTION public.receivable_to_bank_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric(14,2);
  cust_name text;
BEGIN
  delta := COALESCE(NEW.received_amount,0) - COALESCE(OLD.received_amount,0);
  IF delta > 0 AND NEW.bank_account_id IS NOT NULL THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
    INSERT INTO public.bank_movements
      (user_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
    VALUES (
      NEW.user_id,
      NEW.bank_account_id,
      COALESCE(NEW.received_at::date, now()::date),
      'entrada',
      'Recebimento de venda',
      COALESCE(cust_name || ' — ', '') || NEW.description,
      delta,
      'receivable',
      NEW.id
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER receivables_to_bank AFTER UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.receivable_to_bank_movement();
