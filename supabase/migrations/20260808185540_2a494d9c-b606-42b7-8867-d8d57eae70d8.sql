-- 1. Inspecionar colunas reais de payment_routing_rules
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'payment_routing_rules' AND table_schema = 'public';

-- 2. Correção de ensure_empresa_defaults (v4: incluindo user_id em routing rules)
CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(_empresa_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_bank_id UUID;
BEGIN
    -- Categorias (7 canônicas)
    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES 
        ('Mercadorias para Revenda', true, _user_id, _empresa_id),
        ('Serviços Tomados', true, _user_id, _empresa_id),
        ('Despesas Administrativas', true, _user_id, _empresa_id),
        ('Impostos e Taxas', true, _user_id, _empresa_id),
        ('Folha de Pagamento', true, _user_id, _empresa_id),
        ('Aluguel e Utilidades', true, _user_id, _empresa_id),
        ('Marketing e Vendas', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;

    -- Conta Bancária (Banco Principal)
    INSERT INTO public.bank_accounts (name, bank, account_type, initial_balance, color, status, user_id, empresa_id)
    SELECT 'Banco Principal', 'Outros', 'corrente', 0, '#10b981', 'ativa', _user_id, _empresa_id
    WHERE NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE name = 'Banco Principal' AND empresa_id = _empresa_id)
    RETURNING id INTO v_bank_id;

    IF v_bank_id IS NULL THEN
        SELECT id INTO v_bank_id FROM public.bank_accounts WHERE name = 'Banco Principal' AND empresa_id = _empresa_id;
    END IF;

    -- Regras de Roteamento (Incluindo user_id)
    INSERT INTO public.payment_routing_rules (payment_method, bank_account_id, user_id, empresa_id)
    SELECT pm, v_bank_id, _user_id, _empresa_id
    FROM (VALUES 
        ('credit_card'), ('debit_card'), ('pix'), ('bank_transfer'), 
        ('cash'), ('billet'), ('wallet'), ('crypto'), 
        ('other'), ('check'), ('financing'), ('voucher')
    ) AS t(pm)
    ON CONFLICT (payment_method, empresa_id) DO NOTHING;
END;
$function$;

-- 3. Execução do Reparo Atômico (DML)
DO $$
DECLARE
    v_user_id UUID := '1fcb4d6b-61bd-4af9-bf12-87c514094921'::uuid;
    v_empresa_id UUID := 'f958365e-3951-46e6-8595-e4f111115a90'::uuid;
BEGIN
    PERFORM public.ensure_empresa_defaults(v_empresa_id, v_user_id);
    UPDATE public.user_company_access SET is_primary = true, role = 'admin' WHERE user_id = v_user_id AND empresa_id = v_empresa_id;
    DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'vendedor';
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin') ON CONFLICT DO NOTHING;
END $$;

-- 4. Evidência Final
SELECT 'post_repair' as stage, role, is_primary::text, 'membership' as source FROM public.user_company_access WHERE user_id = '1fcb4d6b-61bd-4af9-bf12-87c514094921'
UNION ALL
SELECT 'post_repair' as stage, role, NULL, 'role' as source FROM public.user_roles WHERE user_id = '1fcb4d6b-61bd-4af9-bf12-87c514094921';

SELECT count(*) as total_categories FROM public.categorias_contas_pagar WHERE empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90';
SELECT count(*) as total_bank_accounts FROM public.bank_accounts WHERE empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90';
SELECT count(*) as total_routing_rules FROM public.payment_routing_rules WHERE empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90';
