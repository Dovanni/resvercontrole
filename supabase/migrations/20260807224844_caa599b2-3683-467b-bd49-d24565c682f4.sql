-- Função transacional para finalizar o onboarding
CREATE OR REPLACE FUNCTION public.finalize_user_onboarding(
    p_onboarding_id UUID,
    p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_onboarding RECORD;
    v_empresa_id UUID;
    v_profile_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Validar e travar a reserva de onboarding
    SELECT * INTO v_onboarding
    FROM pending_onboardings
    WHERE id = p_onboarding_id
      AND auth_user_id = p_auth_user_id
      AND status = 'pending'
      FOR UPDATE;

    IF NOT FOUND THEN
        -- Verificar se já foi ativado (idempotência)
        SELECT id INTO v_onboarding
        FROM pending_onboardings
        WHERE id = p_onboarding_id
          AND auth_user_id = p_auth_user_id
          AND status = 'activated';

        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'message', 'Onboarding já concluído anteriormente.');
        ELSE
            RAISE EXCEPTION 'Reserva de onboarding inválida, expirada ou já processada.';
        END IF;
    END IF;

    -- 2. Criar a Empresa
    -- Nota: Usamos os campos da tabela empresas conforme o esquema atual (F2/F3)
    INSERT INTO public.empresas (
        nome,
        razao_social,
        cnpj,
        configuracoes
    )
    VALUES (
        v_onboarding.nome_empresa,
        v_onboarding.nome_empresa, -- Fallback inicial
        v_onboarding.cnpj_limpo,
        jsonb_build_object('onboarding_completed_at', now())
    )
    RETURNING id INTO v_empresa_id;

    -- 3. Criar ou Atualizar Perfil do Usuário
    -- Assumindo que a tabela profiles existe e tem empresa_id
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        empresa_id,
        updated_at
    )
    SELECT 
        p_auth_user_id,
        u.email,
        v_onboarding.nome_admin,
        v_empresa_id,
        now()
    FROM auth.users u
    WHERE u.id = p_auth_user_id
    ON CONFLICT (id) DO UPDATE SET
        empresa_id = v_empresa_id,
        full_name = v_onboarding.nome_admin,
        updated_at = now();

    -- 4. Criar Membresia de Administrador
    -- Assumindo a tabela user_company_access ou similar da Wave A/B
    INSERT INTO public.user_company_access (
        user_id,
        empresa_id,
        role,
        status
    )
    VALUES (
        p_auth_user_id,
        v_empresa_id,
        'admin', -- Role canônico
        'active'
    )
    ON CONFLICT (user_id, empresa_id) DO NOTHING;

    -- 5. Marcar onboarding como ativado
    UPDATE pending_onboardings
    SET status = 'activated',
        updated_at = now()
    WHERE id = p_onboarding_id;

    RETURN jsonb_build_object(
        'success', true, 
        'empresa_id', v_empresa_id,
        'message', 'Onboarding finalizado com sucesso.'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao finalizar onboarding: %', SQLERRM;
END;
$$;

-- Grant EXECUTE
GRANT EXECUTE ON FUNCTION public.finalize_user_onboarding(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_user_onboarding(UUID, UUID) FROM PUBLIC, anon, authenticated;