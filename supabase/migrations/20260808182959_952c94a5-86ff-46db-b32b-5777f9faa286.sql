-- Drop existing functions to avoid parameter name/type conflicts
DROP FUNCTION IF EXISTS public.reconcile_and_finalize_onboarding();
DROP FUNCTION IF EXISTS public.ensure_empresa_defaults(uuid, uuid);

-- 1. Correct public.ensure_empresa_defaults
CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(_empresa_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- A. Provisionar Categorias de Contas a Pagar
    -- 1. Mercadorias para Revenda
    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES ('Mercadorias para Revenda', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;

    -- 2. Serviços Tomados
    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES ('Serviços Tomados', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;
END;
$function$;

-- 2. Correct public.reconcile_and_finalize_onboarding
CREATE OR REPLACE FUNCTION public.reconcile_and_finalize_onboarding()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_onboarding RECORD;
    v_empresa RECORD;
    v_membership RECORD;
    v_generic_empresa_id UUID := 'f958365e-3951-46e6-8595-e4f111115a90'::uuid;
    v_expected_user_id UUID := '1fcb4d6b-61bd-4af9-bf12-87c514094921'::uuid;
    v_expected_onboarding_id UUID := 'fccca265-444e-4473-b26e-f52debeafd41'::uuid;
    v_commercial_records_count INTEGER;
BEGIN
    -- A. Obter e validar identidade
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    -- B. Validar Onboarding Pendente
    SELECT * INTO v_onboarding
    FROM public.pending_onboardings
    WHERE auth_user_id = v_user_id
      AND status = 'pending'
      AND expires_at > now()
      FOR UPDATE;

    IF NOT FOUND THEN
        -- Idempotency check
        IF EXISTS (
            SELECT 1 FROM public.pending_onboardings
            WHERE auth_user_id = v_user_id
              AND status = 'activated'
              AND id = v_expected_onboarding_id
        ) THEN
            RETURN jsonb_build_object('already_finalized', true, 'success', true);
        END IF;
        RAISE EXCEPTION 'Nenhuma reserva de onboarding pendente encontrada para este usuário.';
    END IF;

    -- Identity validation
    IF v_user_id <> v_expected_user_id OR v_onboarding.id <> v_expected_onboarding_id THEN
        RAISE EXCEPTION 'Inconsistência de identidades para reconciliação controlada.';
    END IF;

    -- C. Validar Membership e Empresa Genérica
    SELECT * INTO v_membership
    FROM public.user_company_access
    WHERE user_id = v_user_id
      AND empresa_id = v_generic_empresa_id
      AND status = 'active'
      FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membrosia na empresa genérica não encontrada.';
    END IF;

    SELECT * INTO v_empresa
    FROM public.empresas
    WHERE id = v_generic_empresa_id
      AND nome = 'Minha Empresa'
      FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa genérica não encontrada ou já modificada.';
    END IF;

    -- D. Auditoria de Dados Comerciais/Financeiros
    SELECT COUNT(*) INTO v_commercial_records_count FROM public.sales WHERE empresa_id = v_generic_empresa_id;
    IF v_commercial_records_count > 0 THEN RAISE EXCEPTION 'Empresa possui dados de vendas.'; END IF;

    SELECT COUNT(*) INTO v_commercial_records_count FROM public.compras WHERE empresa_id = v_generic_empresa_id;
    IF v_commercial_records_count > 0 THEN RAISE EXCEPTION 'Empresa possui dados de compras.'; END IF;

    -- E. Transação de Atualização
    -- 1. Atualizar Empresa
    UPDATE public.empresas
    SET nome = v_onboarding.nome_empresa,
        razao_social = v_onboarding.nome_empresa,
        documento = v_onboarding.cnpj_limpo,
        updated_at = now(),
        configuracoes = v_empresa.configuracoes || jsonb_build_object(
            'onboarding_reconciled_at', now(),
            'original_pending_id', v_onboarding.id
        )
    WHERE id = v_generic_empresa_id;

    -- 2. Garantir Role Admin no Membership (Conditional Update, no updated_at)
    UPDATE public.user_company_access
    SET role = 'admin'
    WHERE user_id = v_user_id 
      AND empresa_id = v_generic_empresa_id
      AND role IS DISTINCT FROM 'admin';

    -- 3. Sincronizar user_roles (Admin Global Legacy)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';

    -- 4. Provisionar Defaults
    PERFORM public.ensure_empresa_defaults(v_generic_empresa_id, v_user_id);

    -- 5. Finalizar Onboarding
    UPDATE public.pending_onboardings
    SET status = 'activated',
        activated_at = now(),
        empresa_id = v_generic_empresa_id
    WHERE id = v_onboarding.id;

    RETURN jsonb_build_object(
        'success', true,
        'empresa_id', v_generic_empresa_id,
        'new_name', v_onboarding.nome_empresa
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reconcile_and_finalize_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_empresa_defaults(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_and_finalize_onboarding() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_empresa_defaults(uuid, uuid) TO service_role;
