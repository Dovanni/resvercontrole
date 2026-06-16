
-- Clientes
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  person_type TEXT NOT NULL DEFAULT 'pf' CHECK (person_type IN ('pf','pj')),
  document TEXT,
  customer_type TEXT NOT NULL DEFAULT 'varejo' CHECK (customer_type IN ('varejo','atacado')),
  email TEXT,
  phone TEXT,
  zip TEXT,
  address TEXT,
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX customers_user_idx ON public.customers(user_id);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fornecedores
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  delivery_days INTEGER DEFAULT 0,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suppliers" ON public.suppliers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX suppliers_user_idx ON public.suppliers(user_id);
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contas a pagar
CREATE TABLE public.payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'fornecedor',
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  recurrence TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recurrence IN ('nenhuma','semanal','mensal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payables" ON public.payables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX payables_user_idx ON public.payables(user_id, due_date);
CREATE TRIGGER payables_updated_at BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Quando uma conta a pagar é marcada como paga, registra saída no financeiro
CREATE OR REPLACE FUNCTION public.payable_to_finance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    INSERT INTO public.finance_entries (user_id, type, category, amount, description, entry_date)
    VALUES (NEW.user_id, 'expense', NEW.category, COALESCE(NEW.paid_amount, NEW.amount), NEW.description, COALESCE(NEW.paid_at, now()));
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.payable_to_finance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER payables_to_finance AFTER UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.payable_to_finance();

-- Vincula vendas a clientes e canal
ALTER TABLE public.sales
  ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'varejo' CHECK (channel IN ('varejo','atacado')),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('orcamento','confirmado','separacao','enviado','entregue','cancelado'));

-- Adiciona preço atacado e SKU em produtos
ALTER TABLE public.products
  ADD COLUMN sku TEXT,
  ADD COLUMN wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN image_url TEXT,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo'));
