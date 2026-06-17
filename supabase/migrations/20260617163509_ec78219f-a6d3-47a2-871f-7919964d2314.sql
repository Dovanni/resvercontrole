
-- 1) Make initial balance trigger also handle UPDATE on initial_balance
CREATE OR REPLACE FUNCTION public.bank_account_initial_balance_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.initial_balance IS NOT NULL AND NEW.initial_balance > 0 THEN
    IF EXISTS (SELECT 1 FROM public.bank_movements WHERE account_id = NEW.id AND origin = 'saldo_inicial') THEN
      UPDATE public.bank_movements
        SET amount = NEW.initial_balance,
            description = 'Saldo inicial — ' || NEW.name
        WHERE account_id = NEW.id AND origin = 'saldo_inicial';
    ELSE
      INSERT INTO public.bank_movements
        (user_id, account_id, movement_date, type, category, description, amount, origin)
      VALUES (
        NEW.user_id, NEW.id, COALESCE(NEW.created_at::date, now()::date),
        'entrada', 'Saldo inicial',
        'Saldo inicial — ' || NEW.name,
        NEW.initial_balance, 'saldo_inicial'
      );
    END IF;
  ELSIF NEW.initial_balance IS NULL OR NEW.initial_balance = 0 THEN
    DELETE FROM public.bank_movements WHERE account_id = NEW.id AND origin = 'saldo_inicial';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_account_initial_balance_movement_ins ON public.bank_accounts;
DROP TRIGGER IF EXISTS bank_account_initial_balance_movement_upd ON public.bank_accounts;

CREATE TRIGGER bank_account_initial_balance_movement_ins
AFTER INSERT ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.bank_account_initial_balance_movement();

CREATE TRIGGER bank_account_initial_balance_movement_upd
AFTER UPDATE OF initial_balance, name ON public.bank_accounts
FOR EACH ROW
WHEN (NEW.initial_balance IS DISTINCT FROM OLD.initial_balance OR NEW.name IS DISTINCT FROM OLD.name)
EXECUTE FUNCTION public.bank_account_initial_balance_movement();

-- 2) Backfill missing saldo_inicial movements
INSERT INTO public.bank_movements
  (user_id, account_id, movement_date, type, category, description, amount, origin)
SELECT ba.user_id, ba.id, COALESCE(ba.created_at::date, now()::date),
       'entrada', 'Saldo inicial', 'Saldo inicial — ' || ba.name,
       ba.initial_balance, 'saldo_inicial'
FROM public.bank_accounts ba
WHERE ba.initial_balance > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_movements bm
    WHERE bm.account_id = ba.id AND bm.origin = 'saldo_inicial'
  );

-- 3) Repoint this user's routing rules from the duplicate auto-created MP
--    account to the user-created "Mercado Pago - Metrixhr", and deactivate the duplicate.
UPDATE public.payment_routing_rules
SET bank_account_id = '6b34197c-a847-44b7-917b-afbc3164ab05'
WHERE user_id = '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3'
  AND bank_account_id = 'd8216a75-6cdb-498f-a2e2-183155b3bd07';

UPDATE public.bank_accounts
SET status = 'inativa'
WHERE id = 'd8216a75-6cdb-498f-a2e2-183155b3bd07';
