
-- Extend bank_movements.origin to accept sale + sale_cancellation
ALTER TABLE public.bank_movements DROP CONSTRAINT IF EXISTS bank_movements_origin_check;
ALTER TABLE public.bank_movements ADD CONSTRAINT bank_movements_origin_check
  CHECK (origin = ANY (ARRAY['manual','payable','receivable','transfer','saldo_inicial','sale','sale_cancellation']));

-- Restore product stock when a sale_item is removed (needed for sale editing)
CREATE OR REPLACE FUNCTION public.restore_stock_on_sale_item_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
    SET stock = stock + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id AND user_id = OLD.user_id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS sale_item_restore_stock ON public.sale_items;
CREATE TRIGGER sale_item_restore_stock
  AFTER DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_sale_item_delete();

-- Update create_receivable_for_sale to also fire on status transitions
CREATE OR REPLACE FUNCTION public.create_receivable_for_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cust_name text;
BEGIN
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
END; $$;

-- New: when sale becomes entregue/cancelado, sync receivable + bank movements
CREATE OR REPLACE FUNCTION public.sale_status_to_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cust_name text; r_id uuid;
BEGIN
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
END; $$;

DROP TRIGGER IF EXISTS sale_status_finance ON public.sales;
CREATE TRIGGER sale_status_finance
  AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sale_status_to_finance();

-- Backfill: any 'entregue' sale without a receivable and without a sale-origin movement
INSERT INTO public.bank_movements (user_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
SELECT s.user_id, s.bank_account_id, COALESCE(s.sold_at::date, now()::date),
  'entrada', 'Recebimento de venda',
  'Venda — ' || COALESCE((SELECT name FROM public.customers WHERE id = s.customer_id), s.customer_name, 'balcão'),
  s.total, 'sale', s.id
FROM public.sales s
WHERE s.status = 'entregue'
  AND s.bank_account_id IS NOT NULL
  AND s.total > 0
  AND NOT EXISTS (SELECT 1 FROM public.receivables r WHERE r.sale_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.bank_movements bm WHERE bm.origin='sale' AND bm.reference_id = s.id);
