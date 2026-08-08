-- Migration: 20260808190000_fix_reconcile_onboarding_contract_repair.sql
-- Purpose: Correct contract mismatches in RPC functions for multiempresa onboarding.

-- 1. Ensure public.ensure_empresa_defaults is correct and idempotent
CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(_empresa_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Provision default categories (idempotent via ON CONFLICT)
    -- Column 'updated_at' does NOT exist in categorias_contas_pagar
    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES ('Mercadorias para Revenda', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;

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
    v_generic_empresa_id UUID := 'f958365e-3951-46e6-8595-e4f111115a90'::uuid;
    v_expected_user_id UUID := '1fcb4d6b-61bd-4af9-bf12-87c514094921'::uuid;
    v_expected_onboarding_id UUID := 'fccca265-444e-4473-b26e-f52debeafd41'::uuid;
BEGIN
    -- Authorization Check
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN 
        RAISE EXCEPTION 'Não autenticado'; 
    END IF;

    -- Pre-execution guard: Specific user and active onboarding
    SELECT * INTO v_onboarding FROM public.pending_onboardings
    WHERE auth_user_id = v_user_id 
      AND status = 'pending' 
      AND expires_at > now() 
    FOR UPDATE;

    IF v_onboarding.id IS NULL THEN
        RAISE EXCEPTION 'Nenhum onboarding pendente encontrado para este usuário.';
    END IF;

    -- Structural Validation
    IF v_user_id != v_expected_user_id THEN
        RAISE EXCEPTION 'Usuário não autorizado para esta operação de reconciliação específica.';
    END IF;

    -- Target Company Validation
    SELECT * INTO v_empresa FROM public.empresas WHERE id = v_generic_empresa_id FOR UPDATE;
    IF v_empresa.id IS NULL THEN
        RAISE EXCEPTION 'Empresa alvo não encontrada.';
    END IF;

    -- Phase 1: Update Company Metadata
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

    -- Phase 2: Update Membership (updated_at does NOT exist)
    UPDATE public.user_company_access
    SET role = 'admin'
    WHERE user_id = v_user_id 
      AND empresa_id = v_generic_empresa_id 
      AND role IS DISTINCT FROM 'admin';

    -- Phase 3: Global Roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role;

    -- Phase 4: Defaults Provisioning
    PERFORM public.ensure_empresa_defaults(v_generic_empresa_id, v_user_id);

    -- Phase 5: Mark Onboarding as Completed
    -- Column 'activated_at' and 'empresa_id' do NOT exist in pending_onboardings
    UPDATE public.pending_onboardings
    SET status = 'activated',
        updated_at = now()
    WHERE id = v_onboarding.id;

    RETURN jsonb_build_object(
        'success', true, 
        'empresa_id', v_generic_empresa_id, 
        'new_name', v_onboarding.nome_empresa
    );
END;
$function$;

-- Grants
GRANT EXECUTE ON FUNCTION public.ensure_empresa_defaults(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_empresa_defaults(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_and_finalize_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_and_finalize_onboarding() TO service_role;
