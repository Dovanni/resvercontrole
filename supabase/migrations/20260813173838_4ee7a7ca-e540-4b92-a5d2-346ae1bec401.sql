-- Hardening de Segurança para Validação de CNPJ e Multiempresa

-- 1. Unicidade de Documento para evitar colisão de tenants
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_documento_unique ON public.empresas (documento);

-- 2. Sistema de Rate Limit Durável (RPC)
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    hits INTEGER DEFAULT 1,
    last_hit TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO authenticated, anon;
GRANT ALL ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_rate_limit_persistent(
    _key TEXT,
    _limit INTEGER,
    _window_interval INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_hits INTEGER;
BEGIN
    -- Limpeza de expirados (lazy cleanup)
    DELETE FROM public.rate_limits WHERE expires_at < now();

    INSERT INTO public.rate_limits (key, hits, expires_at)
    VALUES (_key, 1, now() + _window_interval)
    ON CONFLICT (key) DO UPDATE
    SET hits = rate_limits.hits + 1,
        last_hit = now()
    RETURNING hits INTO current_hits;

    RETURN current_hits <= _limit;
END;
$$;

-- 3. RPC para Criação Atômica com Reserva de Documento
CREATE OR REPLACE FUNCTION public.create_pending_onboarding(
    _nome_admin TEXT,
    _nome_empresa TEXT,
    _cnpj_formatado TEXT,
    _cnpj_limpo TEXT,
    _email_hash TEXT,
    _terms_version TEXT,
    _privacy_version TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_emp_id UUID;
BEGIN
    -- Verificar duplicidade antes de inserir
    IF EXISTS (SELECT 1 FROM public.empresas WHERE documento = _cnpj_limpo) THEN
        RAISE EXCEPTION 'COMPANY_ALREADY_EXISTS';
    END IF;

    -- Inserir empresa (owner_id será vinculado depois via link_auth_user_to_onboarding ou similar)
    -- Por enquanto, usamos um placeholder ou permitimos null se a estrutura permitir, 
    -- mas a Wave A exige owner_id NOT NULL.
    -- Vamos ajustar para aceitar o owner_id se já tivermos ou criar a empresa associada ao service_role temporariamente.
    
    INSERT INTO public.empresas (nome, documento, owner_id, status)
    VALUES (_nome_empresa, _cnpj_limpo, auth.uid(), 'active')
    RETURNING id INTO new_emp_id;

    RETURN new_emp_id;
END;
$$;
