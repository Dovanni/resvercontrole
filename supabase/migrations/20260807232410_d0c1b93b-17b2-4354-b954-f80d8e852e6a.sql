
DO $$
BEGIN
    -- Auditoria read-only: Se encontrar duplicidade, o aborto ocorrerá por exceção (PARAR conforme solicitado)
    IF EXISTS (
        SELECT 1
        FROM public.pending_onboardings
        WHERE status = 'pending' AND auth_user_id IS NOT NULL
        GROUP BY auth_user_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'DUPLICIDADE_DETECTADA: Existem usuários com múltiplas reservas pendentes.';
    END IF;

    -- Criar índice único parcial
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_onboardings_single_active 
    ON public.pending_onboardings (auth_user_id) 
    WHERE (status = 'pending' AND auth_user_id IS NOT NULL);

END $$;

-- Atualizar RPC finalize_user_onboarding para remover dependência de p_onboarding_id (usar apenas userId com lock)
CREATE OR REPLACE FUNCTION public.finalize_user_onboarding(
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
    v_onboarding_count INTEGER;
BEGIN
    -- 1. Contar reservas pendentes e válidas para o usuário
    SELECT COUNT(*) INTO v_onboarding_count
    FROM pending_onboardings
    WHERE auth_user_id = p_auth_user_id
      AND status = 'pending'
      AND expires_at > now();

    -- 2. Validar multiplicidade (Segurança Hardened)
    IF v_onboarding_count = 0 THEN
        -- Verificar se já foi ativado (idempotência)
        IF EXISTS (
            SELECT 1 FROM pending_onboardings 
            WHERE auth_user_id = p_auth_user_id AND status = 'activated'
        ) THEN
            RETURN jsonb_build_object('success', true, 'message', 'Onboarding já concluído anteriormente.');
        END IF;
        RAISE EXCEPTION 'Nenhuma reserva de onboarding pendente e válida encontrada.';
    ELSIF v_onboarding_count > 1 THEN
        RAISE EXCEPTION 'Múltiplas reservas pendentes detectadas para o mesmo usuário. Bloqueio de segurança ativado.';
    END IF;

    -- 3. Selecionar a reserva com row lock
    SELECT * INTO v_onboarding
    FROM pending_onboardings
    WHERE auth_user_id = p_auth_user_id
      AND status = 'pending'
      AND expires_at > now()
    FOR UPDATE;

    -- 4. Criar a Empresa
    INSERT INTO public.empresas (nome, razao_social, cnpj, configuracoes)
    VALUES (
        v_onboarding.nome_empresa,
        v_onboarding.nome_empresa,
        v_onboarding.cnpj_limpo,
        jsonb_build_object('onboarding_completed_at', now())
    )
    RETURNING id INTO v_empresa_id;

    -- 5. Perfil
    INSERT INTO public.profiles (id, email, full_name, empresa_id, updated_at)
    SELECT p_auth_user_id, u.email, v_onboarding.nome_admin, v_empresa_id, now()
    FROM auth.users u WHERE u.id = p_auth_user_id
    ON CONFLICT (id) DO UPDATE SET
        empresa_id = v_empresa_id,
        full_name = v_onboarding.nome_admin,
        updated_at = now();

    -- 6. Acesso
    INSERT INTO public.user_company_access (user_id, empresa_id, role, status)
    VALUES (p_auth_user_id, v_empresa_id, 'admin', 'active')
    ON CONFLICT (user_id, empresa_id) DO NOTHING;

    -- 7. Hardening: Marcar reserva como ativada
    UPDATE pending_onboardings
    SET status = 'activated', updated_at = now()
    WHERE id = v_onboarding.id;

    RETURN jsonb_build_object('success', true, 'empresa_id', v_empresa_id);

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Falha na finalização do onboarding: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_user_onboarding(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_user_onboarding(UUID) FROM PUBLIC, anon, authenticated;
