-- 1. Tabela de Onboarding Pendente
CREATE TABLE IF NOT EXISTS public.pending_onboardings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID, -- Vinculado após inviteUserByEmail
    nome_admin TEXT NOT NULL,
    nome_empresa TEXT NOT NULL,
    cnpj_formatado TEXT,
    cnpj_limpo TEXT,
    email_hash TEXT NOT NULL, -- HMAC-SHA256 do e-mail para busca segura
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'expired', 'cancelled')),
    consent_version_terms TEXT NOT NULL,
    consent_version_privacy TEXT NOT NULL,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_pending_onboardings_auth_user_id ON public.pending_onboardings(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_onboardings_email_hash ON public.pending_onboardings(email_hash);
CREATE INDEX IF NOT EXISTS idx_pending_onboardings_status ON public.pending_onboardings(status);

-- 3. RLS e Permissões - NUNCA anon ou authenticated direto
ALTER TABLE public.pending_onboardings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pending_onboardings FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.pending_onboardings TO service_role;

-- 4. RPCs para operações atômicas (Somente service_role)

-- Criar reserva de onboarding
CREATE OR REPLACE FUNCTION public.create_pending_onboarding(
    p_nome_admin TEXT,
    p_nome_empresa TEXT,
    p_cnpj_formatado TEXT,
    p_cnpj_limpo TEXT,
    p_email_hash TEXT,
    p_terms_version TEXT,
    p_privacy_version TEXT,
    p_expires_in_hours INTEGER DEFAULT 24
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO pending_onboardings (
        nome_admin, nome_empresa, cnpj_formatado, cnpj_limpo, email_hash,
        consent_version_terms, consent_version_privacy, expires_at
    )
    VALUES (
        p_nome_admin, p_nome_empresa, p_cnpj_formatado, p_cnpj_limpo, p_email_hash,
        p_terms_version, p_privacy_version, now() + (p_expires_in_hours || ' hours')::INTERVAL
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Vincular Auth User ID à reserva
CREATE OR REPLACE FUNCTION public.link_auth_user_to_onboarding(
    p_onboarding_id UUID,
    p_auth_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE pending_onboardings
    SET auth_user_id = p_auth_user_id,
        updated_at = now()
    WHERE id = p_onboarding_id
      AND status = 'pending';
END;
$$;

-- Cancelar/Remover reserva (Compensação)
CREATE OR REPLACE FUNCTION public.cancel_pending_onboarding(
    p_onboarding_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE pending_onboardings
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = p_onboarding_id;
END;
$$;

-- Grant EXECUTE aos RPCs
GRANT EXECUTE ON FUNCTION public.create_pending_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_auth_user_to_onboarding(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_pending_onboarding(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.create_pending_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_auth_user_to_onboarding(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_pending_onboarding(UUID) FROM PUBLIC, anon, authenticated;