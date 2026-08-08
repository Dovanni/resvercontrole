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
        -- Check for idempotency
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

    -- Validação de Identidade Fixa (apenas para esta reconciliação alvo)
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

    -- D. Auditoria de Dados Comerciais/Financeiros (Esvaziamento)
    SELECT COUNT(*) INTO v_commercial_records_count FROM public.sales WHERE empresa_id = v_generic_empresa_id;
    IF v_commercial_records_count > 0 THEN RAISE EXCEPTION 'Empresa possui dados de vendas.'; END IF;
    
    SELECT COUNT(*) INTO v_commercial_records_count FROM public.compras WHERE empresa_id = v_generic_empresa_id;
    IF v_commercial_records_count > 0 THEN RAISE EXCEPTION 'Empresa possui dados de compras.'; END IF;

    -- E. Transação de Atualização
    -- 1. Atualizar Empresa
    UPDATE public.empresas
    SET nome = v_onboarding.nome_empresa,
        razao_social = v_onboarding.nome_empresa,
        documento = v_onboarding.cnpj_limpo, -- Corrigido para 'documento'
        updated_at = now(),
        configuracoes = v_empresa.configuracoes || jsonb_build_object(
            'onboarding_reconciled_at', now(),
            'original_pending_id', v_onboarding.id
        )
    WHERE id = v_generic_empresa_id;

    -- 2. Garantir Role Admin no Membership
    UPDATE public.user_company_access
    SET role = 'admin',
        updated_at = now()
    WHERE user_id = v_user_id AND empresa_id = v_generic_empresa_id;

    -- 3. Sincronizar user_roles (Admin Global Legacy)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';

    -- 4. provisionar Defaults (usa a função já corrigida com ON CONFLICT (user_id, ...))
    PERFORM public.ensure_empresa_defaults(v_user_id, v_generic_empresa_id);

    -- 5. Finalizar Onboarding
    UPDATE public.pending_onboardings
    SET status = 'activated',
        updated_at = now()
    WHERE id = v_onboarding.id;

    RETURN jsonb_build_object(
        'success', true,
        'already_finalized', false,
        'empresa_id', v_generic_empresa_id
    );
END;
$function$

