
CREATE TABLE public.categorias_contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_contas_pagar TO authenticated;
GRANT ALL ON public.categorias_contas_pagar TO service_role;

ALTER TABLE public.categorias_contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categorias_contas_pagar"
  ON public.categorias_contas_pagar
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.seed_default_categorias_contas_pagar(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categorias_contas_pagar (user_id, nome, padrao) VALUES
    (_user_id, 'Fornecedor', true),
    (_user_id, 'Logística', true),
    (_user_id, 'Marketing', true),
    (_user_id, 'Aluguel', true),
    (_user_id, 'Impostos', true),
    (_user_id, 'Outros', true)
  ON CONFLICT (user_id, nome) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  PERFORM public.ensure_default_routing(NEW.id);
  PERFORM public.seed_default_categorias_contas_pagar(NEW.id);
  RETURN NEW;
END;
$$;

-- Seed for existing users
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_default_categorias_contas_pagar(u.id);
  END LOOP;
END $$;
