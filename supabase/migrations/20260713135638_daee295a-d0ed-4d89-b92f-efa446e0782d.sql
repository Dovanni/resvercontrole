CREATE OR REPLACE FUNCTION public.payable_to_bank_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sup_name text;
  should_create boolean := false;
BEGIN
  -- Cenário 1: transição de status para 'pago' com conta bancária definida
  IF NEW.status = 'pago'
     AND (OLD.status IS DISTINCT FROM 'pago')
     AND NEW.bank_account_id IS NOT NULL
  THEN
    should_create := true;
  END IF;

  -- Cenário 2: já estava pago sem conta e agora recebeu bank_account_id
  IF NEW.status = 'pago'
     AND OLD.bank_account_id IS NULL
     AND NEW.bank_account_id IS NOT NULL
  THEN
    should_create := true;
  END IF;

  IF should_create AND NOT EXISTS (
    SELECT 1 FROM public.bank_movements
     WHERE origin = 'payable' AND reference_id = NEW.id
  ) THEN
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
END;
$function$;