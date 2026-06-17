
-- Permitir origem 'saldo_inicial' nas movimentações bancárias
ALTER TABLE public.bank_movements DROP CONSTRAINT IF EXISTS bank_movements_origin_check;
ALTER TABLE public.bank_movements ADD CONSTRAINT bank_movements_origin_check
  CHECK (origin = ANY (ARRAY['manual'::text,'payable'::text,'receivable'::text,'transfer'::text,'saldo_inicial'::text]));

-- Função/trigger: gera movimentação de saldo inicial quando conta é criada com initial_balance > 0
CREATE OR REPLACE FUNCTION public.bank_account_initial_balance_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.initial_balance IS NOT NULL AND NEW.initial_balance > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bank_movements
      WHERE account_id = NEW.id AND origin = 'saldo_inicial'
    ) THEN
      INSERT INTO public.bank_movements
        (user_id, account_id, movement_date, type, category, description, amount, origin)
      VALUES (
        NEW.user_id, NEW.id, NEW.created_at::date,
        'entrada', 'Saldo inicial',
        'Saldo inicial — ' || NEW.name,
        NEW.initial_balance, 'saldo_inicial'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_accounts_initial_balance_movement ON public.bank_accounts;
CREATE TRIGGER bank_accounts_initial_balance_movement
AFTER INSERT ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.bank_account_initial_balance_movement();

-- Backfill: gera movimentações faltantes para contas existentes
INSERT INTO public.bank_movements
  (user_id, account_id, movement_date, type, category, description, amount, origin)
SELECT
  ba.user_id, ba.id, ba.created_at::date,
  'entrada', 'Saldo inicial',
  'Saldo inicial — ' || ba.name,
  ba.initial_balance, 'saldo_inicial'
FROM public.bank_accounts ba
WHERE ba.initial_balance > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_movements bm
    WHERE bm.account_id = ba.id AND bm.origin = 'saldo_inicial'
  );
