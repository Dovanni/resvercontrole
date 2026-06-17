
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.create_receivable_for_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cust_name text;
BEGIN
  IF NEW.status = 'confirmado'
     AND NEW.payment_method IN ('prazo','boleto','crediario','pix_prazo','cartao','cartao_credito','cartao_debito','mercado_livre')
     AND NEW.total > 0
     AND NOT EXISTS (SELECT 1 FROM public.receivables WHERE sale_id = NEW.id)
  THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
    INSERT INTO public.receivables (user_id, customer_id, sale_id, description, amount, due_date, payment_method, bank_account_id)
    VALUES (
      NEW.user_id,
      NEW.customer_id,
      NEW.id,
      'Venda ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
      NEW.total,
      (NEW.sold_at::date + INTERVAL '30 days')::date,
      NEW.payment_method,
      NEW.bank_account_id
    );
  END IF;
  RETURN NEW;
END; $function$;
