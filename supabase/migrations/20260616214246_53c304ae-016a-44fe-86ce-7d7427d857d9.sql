
CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  received_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  received_at timestamptz,
  payment_method text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','parcial','atrasado','cancelado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX receivables_user_idx ON public.receivables(user_id, due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.receivables TO service_role;

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receivables" ON public.receivables FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TRIGGER receivables_updated_at BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate receivable when a non-cash sale is confirmed
CREATE OR REPLACE FUNCTION public.create_receivable_for_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cust_name text;
BEGIN
  IF NEW.status = 'confirmado'
     AND NEW.payment_method IN ('prazo','boleto','crediario','pix_prazo','cartao')
     AND NEW.total > 0
     AND NOT EXISTS (SELECT 1 FROM public.receivables WHERE sale_id = NEW.id)
  THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
    INSERT INTO public.receivables (user_id, customer_id, sale_id, description, amount, due_date, payment_method)
    VALUES (
      NEW.user_id,
      NEW.customer_id,
      NEW.id,
      'Venda ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
      NEW.total,
      (NEW.sold_at::date + INTERVAL '30 days')::date,
      NEW.payment_method
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER sale_create_receivable AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.create_receivable_for_sale();

-- When a receivable is marked received (total or partial), create income entry
CREATE OR REPLACE FUNCTION public.receivable_to_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta numeric(12,2);
BEGIN
  delta := COALESCE(NEW.received_amount,0) - COALESCE(OLD.received_amount,0);
  IF delta > 0 THEN
    INSERT INTO public.finance_entries (user_id, type, category, amount, description, entry_date)
    VALUES (NEW.user_id, 'income', 'recebimento', delta, NEW.description, COALESCE(NEW.received_at, now()));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER receivables_to_finance AFTER UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.receivable_to_finance();

-- Avoid double-counting: stop sales trigger from auto-inserting income for credit sales
CREATE OR REPLACE FUNCTION public.create_finance_for_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.total > 0 AND NEW.payment_method IN ('dinheiro','pix','debito') THEN
    INSERT INTO public.finance_entries (user_id, type, category, amount, description, sale_id, entry_date)
    VALUES (NEW.user_id, 'income', 'venda', NEW.total, COALESCE('Venda '||COALESCE(NEW.customer_name,'balcão'),'Venda'), NEW.id, NEW.sold_at);
  END IF;
  RETURN NEW;
END; $$;
