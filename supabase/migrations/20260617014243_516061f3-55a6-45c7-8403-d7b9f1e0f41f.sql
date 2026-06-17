
CREATE TABLE IF NOT EXISTS public.payment_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  fixo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, payment_method)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_routing_rules TO authenticated;
GRANT ALL ON public.payment_routing_rules TO service_role;

ALTER TABLE public.payment_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their routing rules"
  ON public.payment_routing_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_payment_routing_rules_updated_at
  BEFORE UPDATE ON public.payment_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seeder: ensures Mercado Pago account + default rules exist for a user
CREATE OR REPLACE FUNCTION public.ensure_default_routing(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mp_id uuid;
BEGIN
  SELECT id INTO mp_id FROM public.bank_accounts
    WHERE user_id = _user_id AND bank = 'Mercado Pago' LIMIT 1;

  IF mp_id IS NULL THEN
    INSERT INTO public.bank_accounts (user_id, name, bank, account_type, initial_balance, color, status)
    VALUES (_user_id, 'Mercado Pago', 'Mercado Pago', 'digital', 0, '#00B1EA', 'ativa')
    RETURNING id INTO mp_id;
  END IF;

  INSERT INTO public.payment_routing_rules (user_id, payment_method, bank_account_id, fixo) VALUES
    (_user_id, 'cartao_credito', mp_id, true),
    (_user_id, 'cartao_debito',  mp_id, true),
    (_user_id, 'mercado_livre',  mp_id, true),
    (_user_id, 'cartao',         mp_id, true),
    (_user_id, 'pix',            NULL,  false),
    (_user_id, 'pix_prazo',      NULL,  false),
    (_user_id, 'deposito',       NULL,  false),
    (_user_id, 'dinheiro',       NULL,  false),
    (_user_id, 'transferencia',  NULL,  false),
    (_user_id, 'boleto',         NULL,  false),
    (_user_id, 'crediario',      NULL,  false),
    (_user_id, 'prazo',          NULL,  false)
  ON CONFLICT (user_id, payment_method) DO NOTHING;
END;
$$;

-- Backfill existing users
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.ensure_default_routing(u.id);
  END LOOP;
END $$;

-- Extend handle_new_user to seed routing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  PERFORM public.ensure_default_routing(NEW.id);
  RETURN NEW;
END;
$$;
