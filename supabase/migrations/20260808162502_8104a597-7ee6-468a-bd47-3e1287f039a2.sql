CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(p_user_id uuid, p_empresa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    DECLARE
      v_mp_id uuid;
    BEGIN
      -- Validar existência e membership
      IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_id = p_user_id AND empresa_id = p_empresa_id AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'Acesso não autorizado ou inexistente para esta empresa.';
      END IF;

      -- 1. Conta Bancária Padrão (Mercado Pago)
      -- Idempotente por empresa_id + nome (ou bank)
      SELECT id INTO v_mp_id FROM public.bank_accounts 
      WHERE empresa_id = p_empresa_id AND (name = 'Mercado Pago' OR bank = 'Mercado Pago')
      LIMIT 1;

      IF v_mp_id IS NULL THEN
        INSERT INTO public.bank_accounts (user_id, empresa_id, name, bank, account_type, initial_balance, color, status)
        VALUES (p_user_id, p_empresa_id, 'Mercado Pago', 'Mercado Pago', 'digital', 0, '#00B1EA', 'ativa')
        RETURNING id INTO v_mp_id;
      END IF;

      -- 2. Regras de Roteamento Padrão
      -- A constraint única é (user_id, payment_method)
      IF v_mp_id IS NOT NULL THEN
        INSERT INTO public.payment_routing_rules (user_id, empresa_id, payment_method, bank_account_id, fixo) VALUES
          (p_user_id, p_empresa_id, 'cartao_credito', v_mp_id, true),
          (p_user_id, p_empresa_id, 'cartao_debito',  v_mp_id, true),
          (p_user_id, p_empresa_id, 'mercado_livre',  v_mp_id, true),
          (p_user_id, p_empresa_id, 'cartao',         v_mp_id, true),
          (p_user_id, p_empresa_id, 'pix',            NULL,  false),
          (p_user_id, p_empresa_id, 'pix_prazo',      NULL,  false),
          (p_user_id, p_empresa_id, 'deposito',       NULL,  false),
          (p_user_id, p_empresa_id, 'dinheiro',       NULL,  false),
          (p_user_id, p_empresa_id, 'transferencia',  NULL,  false),
          (p_user_id, p_empresa_id, 'boleto',         NULL,  false),
          (p_user_id, p_empresa_id, 'crediario',      NULL,  false),
          (p_user_id, p_empresa_id, 'prazo',          NULL,  false)
        ON CONFLICT (user_id, payment_method) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, bank_account_id = EXCLUDED.bank_account_id, fixo = EXCLUDED.fixo;
      END IF;

      -- 3. Categorias Padrão
      -- A constraint única é (user_id, nome)
      INSERT INTO public.categorias_contas_pagar (user_id, empresa_id, nome, padrao) VALUES
        (p_user_id, p_empresa_id, 'Fornecedor', true),
        (p_user_id, p_empresa_id, 'Logística', true),
        (p_user_id, p_empresa_id, 'Marketing', true),
        (p_user_id, p_empresa_id, 'Aluguel', true),
        (p_user_id, p_empresa_id, 'Impostos', true),
        (p_user_id, p_empresa_id, 'Cartão de Crédito', true),
        (p_user_id, p_empresa_id, 'Outros', true)
      ON CONFLICT (user_id, nome) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, padrao = EXCLUDED.padrao;

    END;
    $function$;