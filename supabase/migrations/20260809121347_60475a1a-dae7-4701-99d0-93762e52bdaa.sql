-- VEJAMAIS MULTIEMPRESA — CORREÇÃO FINAL DOS GATILHOS FINANCEIROS (V2)
-- Objetivo: Garantir que as validações de empresa_id falhem ativamente quando violadas.

-- 1. Hardening payable_to_bank_movement
CREATE OR REPLACE FUNCTION public.payable_to_bank_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sup_name text;
  v_empresa_id uuid;
  v_actual_account_empresa_id uuid;
BEGIN
  -- Autoridade de empresa: sempre o payable original
  v_empresa_id := NEW.empresa_id;

  -- Validação de consistência se bank_account_id estiver presente
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT empresa_id INTO v_actual_account_empresa_id FROM public.bank_accounts WHERE id = NEW.bank_account_id;
    
    IF v_actual_account_empresa_id IS DISTINCT FROM v_empresa_id THEN
      RAISE EXCEPTION 'A conta bancária selecionada não pertence à empresa do lançamento (ID: %, Empresa: %).', 
        NEW.bank_account_id, v_empresa_id;
    END IF;
  END IF;

  -- Lógica de criação de movimento
  IF NEW.status = 'pago' AND (
      (OLD.status IS DISTINCT FROM 'pago') OR 
      (OLD.bank_account_id IS NULL AND NEW.bank_account_id IS NOT NULL)
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bank_movements 
      WHERE origin = 'payable' AND reference_id = NEW.id
    ) THEN
      SELECT name INTO sup_name FROM public.suppliers WHERE id = NEW.supplier_id AND empresa_id = v_empresa_id;
      
      INSERT INTO public.bank_movements
        (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
      VALUES (
        NEW.user_id,
        v_empresa_id,
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
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Hardening receivable_to_bank_movement
CREATE OR REPLACE FUNCTION public.receivable_to_bank_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  delta numeric(14,2);
  cust_name text;
  v_empresa_id uuid;
  v_actual_account_empresa_id uuid;
BEGIN
  v_empresa_id := NEW.empresa_id;
  delta := COALESCE(NEW.received_amount,0) - COALESCE(OLD.received_amount,0);
  
  -- Validação de consistência se bank_account_id estiver presente
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT empresa_id INTO v_actual_account_empresa_id FROM public.bank_accounts WHERE id = NEW.bank_account_id;
    
    IF v_actual_account_empresa_id IS DISTINCT FROM v_empresa_id THEN
      RAISE EXCEPTION 'A conta bancária selecionada não pertence à empresa do recebimento (ID: %, Empresa: %).', 
        NEW.bank_account_id, v_empresa_id;
    END IF;
  END IF;

  IF delta > 0 AND NEW.bank_account_id IS NOT NULL THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id AND empresa_id = v_empresa_id;
    
    INSERT INTO public.bank_movements
      (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
    VALUES (
      NEW.user_id,
      v_empresa_id,
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
END;
$function$;
