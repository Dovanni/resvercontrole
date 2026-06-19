
-- Add aporte fields to customers
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS aporte_type text,
  ADD COLUMN IF NOT EXISTS aporte_notes text;

-- Add aporte type to sales
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS aporte_type text;

-- Skip receivable creation for Recursos Financeiros (not a real sale)
CREATE OR REPLACE FUNCTION public.create_receivable_for_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cust_name text;
BEGIN
  IF NEW.channel = 'recursos_financeiros' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('confirmado','separacao','enviado','entregue')
     AND NEW.payment_method IN ('prazo','boleto','crediario','pix_prazo','cartao','cartao_credito','cartao_debito','mercado_livre')
     AND NEW.total > 0
     AND NOT EXISTS (SELECT 1 FROM public.receivables WHERE sale_id = NEW.id)
  THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
    INSERT INTO public.receivables (user_id, customer_id, sale_id, description, amount, due_date, payment_method, bank_account_id)
    VALUES (NEW.user_id, NEW.customer_id, NEW.id,
      'Venda ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
      NEW.total, (NEW.sold_at::date + INTERVAL '30 days')::date,
      NEW.payment_method, NEW.bank_account_id);
  END IF;
  RETURN NEW;
END; $function$;

-- Sale status trigger: for RF, create bank movement with own category
CREATE OR REPLACE FUNCTION public.sale_status_to_finance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cust_name text; r_id uuid;
BEGIN
  IF NEW.channel = 'recursos_financeiros' THEN
    IF NEW.status IN ('confirmado','entregue')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
       AND NEW.bank_account_id IS NOT NULL
       AND NEW.total > 0
       AND NOT EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='aporte' AND reference_id = NEW.id)
    THEN
      SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
      INSERT INTO public.bank_movements (user_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
      VALUES (NEW.user_id, NEW.bank_account_id, COALESCE(NEW.sold_at::date, now()::date),
        'entrada', 'Aporte/Recurso Financeiro',
        COALESCE(cust_name, NEW.customer_name, 'Aporte') || ' — ' || COALESCE(NEW.aporte_type, 'recurso'),
        NEW.total, 'aporte', NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'entregue' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'entregue') THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
    SELECT id INTO r_id FROM public.receivables WHERE sale_id = NEW.id LIMIT 1;
    IF r_id IS NOT NULL THEN
      UPDATE public.receivables
        SET received_amount = amount,
            status = 'recebido',
            received_at = COALESCE(received_at, now())
        WHERE id = r_id AND COALESCE(received_amount,0) < amount;
    ELSIF NEW.bank_account_id IS NOT NULL AND NEW.total > 0 THEN
      IF NOT EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='sale' AND reference_id = NEW.id) THEN
        INSERT INTO public.bank_movements (user_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
        VALUES (NEW.user_id, NEW.bank_account_id, COALESCE(NEW.sold_at::date, now()::date),
          'entrada', 'Recebimento de venda',
          'Venda — ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
          NEW.total, 'sale', NEW.id);
      END IF;
    END IF;
  ELSIF NEW.status = 'cancelado' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'cancelado' THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
    UPDATE public.receivables SET status='cancelado' WHERE sale_id = NEW.id AND status <> 'cancelado';
    IF EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='sale' AND reference_id = NEW.id)
       AND NOT EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='sale_cancellation' AND reference_id = NEW.id) THEN
      INSERT INTO public.bank_movements (user_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
      SELECT NEW.user_id, account_id, now()::date, 'saida', 'Estorno de venda',
        'Estorno — ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
        amount, 'sale_cancellation', NEW.id
      FROM public.bank_movements WHERE origin='sale' AND reference_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;
