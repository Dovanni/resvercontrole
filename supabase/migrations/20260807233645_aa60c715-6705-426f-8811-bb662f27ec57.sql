
DO $$ 
BEGIN
    -- 1. Refatorar handle_new_user() para remover provisionamento de negócio
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $function$
    BEGIN
      -- Provisionar somente o perfil básico
      INSERT INTO public.profiles (id, full_name) 
      VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
      
      -- Seed de categorias (precisa de empresa_id agora, removido daqui)
      -- ensure_default_routing (precisa de empresa_id, removido daqui)
      
      RETURN NEW;
    END;
    $function$;

    -- 2. Criar função canônica ensure_empresa_defaults
    CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(
      p_user_id uuid,
      p_empresa_id uuid
    )
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
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
      -- Idempotente por empresa_id + nome
      INSERT INTO public.bank_accounts (user_id, empresa_id, name, bank, account_type, initial_balance, color, status)
      VALUES (p_user_id, p_empresa_id, 'Mercado Pago', 'Mercado Pago', 'digital', 0, '#00B1EA', 'ativa')
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_mp_id;

      -- Se não retornou id (já existia), buscar o id existente
      IF v_mp_id IS NULL THEN
        SELECT id INTO v_mp_id FROM public.bank_accounts 
        WHERE empresa_id = p_empresa_id AND (name = 'Mercado Pago' OR bank = 'Mercado Pago')
        LIMIT 1;
      END IF;

      -- 2. Regras de Roteamento Padrão
      -- Idempotente por user_id + empresa_id + payment_method
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
        ON CONFLICT (user_id, empresa_id, payment_method) DO NOTHING;
      END IF;

      -- 3. Categorias Padrão
      -- Idempotente por empresa_id + nome
      INSERT INTO public.categorias_contas_pagar (user_id, empresa_id, nome, padrao) VALUES
        (p_user_id, p_empresa_id, 'Fornecedor', true),
        (p_user_id, p_empresa_id, 'Logística', true),
        (p_user_id, p_empresa_id, 'Marketing', true),
        (p_user_id, p_empresa_id, 'Aluguel', true),
        (p_user_id, p_empresa_id, 'Impostos', true),
        (p_user_id, p_empresa_id, 'Cartão de Crédito', true),
        (p_user_id, p_empresa_id, 'Outros', true)
      ON CONFLICT (empresa_id, nome) DO NOTHING;

    END;
    $function$;

    -- Restringir acesso à nova função
    REVOKE ALL ON FUNCTION public.ensure_empresa_defaults(uuid, uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ensure_empresa_defaults(uuid, uuid) TO service_role;

    -- 3. Integrar no finalize_user_onboarding
    CREATE OR REPLACE FUNCTION public.finalize_user_onboarding(p_auth_user_id uuid)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $function$
    DECLARE
        v_onboarding RECORD;
        v_empresa_id UUID;
        v_onboarding_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_onboarding_count FROM pending_onboardings
        WHERE auth_user_id = p_auth_user_id AND status = 'pending' AND expires_at > now();

        IF v_onboarding_count = 0 THEN
            IF EXISTS (SELECT 1 FROM pending_onboardings WHERE auth_user_id = p_auth_user_id AND status = 'activated') THEN
                RETURN jsonb_build_object('success', true, 'message', 'Onboarding já concluído anteriormente.');
            END IF;
            RAISE EXCEPTION 'Nenhuma reserva de onboarding pendente e válida encontrada.';
        ELSIF v_onboarding_count > 1 THEN
            RAISE EXCEPTION 'Múltiplas reservas pendentes detectadas para o mesmo usuário.';
        END IF;

        SELECT * INTO v_onboarding FROM pending_onboardings
        WHERE auth_user_id = p_auth_user_id AND status = 'pending' AND expires_at > now()
        FOR UPDATE;

        -- Criar Empresa
        INSERT INTO public.empresas (nome, razao_social, cnpj, configuracoes)
        VALUES (v_onboarding.nome_empresa, v_onboarding.nome_empresa, v_onboarding.cnpj_limpo, jsonb_build_object('onboarding_completed_at', now()))
        RETURNING id INTO v_empresa_id;

        -- Atualizar Perfil e Acesso
        INSERT INTO public.profiles (id, full_name, empresa_id, updated_at)
        VALUES (p_auth_user_id, v_onboarding.nome_admin, v_empresa_id, now())
        ON CONFLICT (id) DO UPDATE SET empresa_id = v_empresa_id, full_name = v_onboarding.nome_admin, updated_at = now();

        INSERT INTO public.user_company_access (user_id, empresa_id, role, status)
        VALUES (p_auth_user_id, v_empresa_id, 'admin', 'active')
        ON CONFLICT (user_id, empresa_id) DO UPDATE SET status = 'active', role = 'admin';

        -- Chamar provisionamento de negócio
        PERFORM public.ensure_empresa_defaults(p_auth_user_id, v_empresa_id);

        -- Finalizar onboarding
        UPDATE pending_onboardings SET status = 'activated', updated_at = now() WHERE id = v_onboarding.id;

        RETURN jsonb_build_object('success', true, 'empresa_id', v_empresa_id);
    END;
    $function$;

    -- 4. Integrar no accept_company_invitation
    CREATE OR REPLACE FUNCTION public.accept_company_invitation(_token_hash text)
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $function$
    DECLARE
        v_invitation_id UUID;
        v_empresa_id UUID;
        v_role public.app_role;
        v_user_id UUID := auth.uid();
    BEGIN
        IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

        SELECT id, empresa_id, role INTO v_invitation_id, v_empresa_id, v_role
        FROM public.company_invitations
        WHERE token_hash = _token_hash AND status = 'pending' AND expires_at > now();

        IF v_invitation_id IS NULL THEN RAISE EXCEPTION 'Convite inválido ou expirado'; END IF;

        INSERT INTO public.user_company_access (user_id, empresa_id, role)
        VALUES (v_user_id, v_empresa_id, v_role)
        ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';

        -- Provisionar defaults se necessário (idempotente)
        PERFORM public.ensure_empresa_defaults(v_user_id, v_empresa_id);

        UPDATE public.company_invitations SET status = 'accepted', accepted_at = now() WHERE id = v_invitation_id;
        RETURN TRUE;
    END;
    $function$;
END $$;
