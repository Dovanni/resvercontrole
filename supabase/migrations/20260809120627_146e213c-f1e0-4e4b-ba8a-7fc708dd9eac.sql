-- 1. Atualizar payable_to_bank_movement para propagar empresa_id
CREATE OR REPLACE FUNCTION public.payable_to_bank_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sup_name text;
  should_create boolean := false;
  v_empresa_id uuid;
BEGIN
  -- Autoridade de empresa: sempre o payable original
  v_empresa_id := NEW.empresa_id;

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
    -- Validação de consistência: conta bancária deve pertencer à mesma empresa
    IF NOT EXISTS (
      SELECT 1 FROM public.bank_accounts 
      WHERE id = NEW.bank_account_id AND empresa_id = v_empresa_id
    ) THEN
      RAISE EXCEPTION 'A conta bancária selecionada não pertence à empresa do lançamento.';
    END IF;

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
  RETURN NEW;
END;
$function$;

-- 2. Atualizar payable_to_finance para propagar empresa_id
CREATE OR REPLACE FUNCTION public.payable_to_finance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    INSERT INTO public.finance_entries (user_id, empresa_id, type, category, amount, description, entry_date)
    VALUES (NEW.user_id, NEW.empresa_id, 'expense', NEW.category, COALESCE(NEW.paid_amount, NEW.amount), NEW.description, COALESCE(NEW.paid_at, now()));
  END IF;
  RETURN NEW;
END; $$;

-- 3. Atualizar receivable_to_bank_movement para propagar empresa_id
CREATE OR REPLACE FUNCTION public.receivable_to_bank_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric(14,2);
  cust_name text;
  v_empresa_id uuid;
BEGIN
  v_empresa_id := NEW.empresa_id;
  delta := COALESCE(NEW.received_amount,0) - COALESCE(OLD.received_amount,0);
  
  IF delta > 0 AND NEW.bank_account_id IS NOT NULL THEN
    -- Validação de consistência
    IF NOT EXISTS (
      SELECT 1 FROM public.bank_accounts 
      WHERE id = NEW.bank_account_id AND empresa_id = v_empresa_id
    ) THEN
      RAISE EXCEPTION 'A conta bancária selecionada não pertence à empresa do recebimento.';
    END IF;

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
END; $$;

-- 4. Atualizar receivable_to_finance para propagar empresa_id
CREATE OR REPLACE FUNCTION public.receivable_to_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta numeric(12,2);
BEGIN
  delta := COALESCE(NEW.received_amount,0) - COALESCE(OLD.received_amount,0);
  IF delta > 0 THEN
    INSERT INTO public.finance_entries (user_id, empresa_id, type, category, amount, description, entry_date)
    VALUES (NEW.user_id, NEW.empresa_id, 'income', 'recebimento', delta, NEW.description, COALESCE(NEW.received_at, now()));
  END IF;
  RETURN NEW;
END; $$;

-- 5. Atualizar create_finance_for_sale para propagar empresa_id
CREATE OR REPLACE FUNCTION public.create_finance_for_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.total > 0 AND NEW.payment_method IN ('dinheiro','pix','debito') THEN
    INSERT INTO public.finance_entries (user_id, empresa_id, type, category, amount, description, sale_id, entry_date)
    VALUES (NEW.user_id, NEW.empresa_id, 'income', 'venda', NEW.total, COALESCE('Venda '||COALESCE(NEW.customer_name,'balcão'),'Venda'), NEW.id, NEW.sold_at);
  END IF;
  RETURN NEW;
END; $$;

-- 6. Atualizar bank_account_initial_balance_movement para propagar empresa_id
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
        (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin)
      VALUES (
        NEW.user_id, NEW.empresa_id, NEW.id, COALESCE(NEW.created_at::date, now()::date),
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

-- 7. Atualizar log_audit para propagar empresa_id (se disponível na tabela origem)
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_empresa_id uuid;
  v_row_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_row_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
    -- Tenta capturar empresa_id do OLD se existir
    BEGIN v_empresa_id := OLD.empresa_id; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user := NEW.user_id;
    v_row_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    BEGIN v_empresa_id := NEW.empresa_id; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
  ELSE
    v_user := NEW.user_id;
    v_row_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
    BEGIN v_empresa_id := NEW.empresa_id; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
  END IF;

  -- Verifica se audit_log tem a coluna empresa_id (deveria ter sido expandida na Wave A)
  -- Se não tiver, o INSERT falhará ou ignorará, mas aqui garantimos o preenchimento caso exista.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_log' AND column_name = 'empresa_id'
  ) THEN
      INSERT INTO public.audit_log (user_id, empresa_id, table_name, op, row_id, old_data, new_data)
      VALUES (v_user, v_empresa_id, TG_TABLE_NAME, TG_OP, v_row_id, v_old, v_new);
  ELSE
      INSERT INTO public.audit_log (user_id, table_name, op, row_id, old_data, new_data)
      VALUES (v_user, TG_TABLE_NAME, TG_OP, v_row_id, v_old, v_new);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
