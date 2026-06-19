ALTER TABLE public.bank_movements DROP CONSTRAINT IF EXISTS bank_movements_origin_check;
ALTER TABLE public.bank_movements ADD CONSTRAINT bank_movements_origin_check CHECK (origin = ANY (ARRAY['manual'::text, 'payable'::text, 'receivable'::text, 'transfer'::text, 'saldo_inicial'::text, 'sale'::text, 'sale_cancellation'::text, 'cartao_fatura'::text]));

INSERT INTO public.categorias_contas_pagar (user_id, nome, padrao)
SELECT id, 'Cartão de Crédito', true FROM auth.users
ON CONFLICT (user_id, nome) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_default_categorias_contas_pagar(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.categorias_contas_pagar (user_id, nome, padrao) VALUES
    (_user_id, 'Fornecedor', true),
    (_user_id, 'Logística', true),
    (_user_id, 'Marketing', true),
    (_user_id, 'Aluguel', true),
    (_user_id, 'Impostos', true),
    (_user_id, 'Cartão de Crédito', true),
    (_user_id, 'Outros', true)
  ON CONFLICT (user_id, nome) DO NOTHING;
END;
$function$;