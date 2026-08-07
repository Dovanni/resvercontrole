-- 1. Tabela Técnica de Rate Limiting
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL,
    identity_kind TEXT NOT NULL,
    identity_hash TEXT NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    escalation_level INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    blocked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(scope, identity_kind, identity_hash)
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked_until ON public.auth_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expires_at ON public.auth_rate_limits(expires_at);

-- 3. RLS e Permissões
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_rate_limits FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.auth_rate_limits TO service_role;

-- 4. Função: Verificar Bloqueio Atual (Read-only para o Worker)
CREATE OR REPLACE FUNCTION public.get_auth_rate_limit_status(
    p_scope TEXT,
    p_identity_kind TEXT,
    p_identity_hash TEXT
)
RETURNS TABLE (
    is_blocked BOOLEAN,
    retry_after_seconds INTEGER,
    failure_count INTEGER,
    escalation_level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_blocked_until TIMESTAMPTZ;
    v_failure_count INTEGER;
    v_escalation_level INTEGER;
BEGIN
    SELECT blocked_until, auth_rate_limits.failure_count, auth_rate_limits.escalation_level
    INTO v_blocked_until, v_failure_count, v_escalation_level
    FROM auth_rate_limits
    WHERE scope = p_scope
      AND identity_kind = p_identity_kind
      AND identity_hash = p_identity_hash;

    IF FOUND AND v_blocked_until IS NOT NULL AND v_blocked_until > v_now THEN
        RETURN QUERY SELECT 
            TRUE, 
            ceil(extract(epoch from (v_blocked_until - v_now)))::INTEGER,
            v_failure_count,
            v_escalation_level;
    ELSE
        RETURN QUERY SELECT FALSE, 0, COALESCE(v_failure_count, 0), COALESCE(v_escalation_level, 0);
    END IF;
END;
$$;

-- 5. Função: Registrar Falha Atomicamente
CREATE OR REPLACE FUNCTION public.record_auth_failure(
    p_scope TEXT,
    p_identity_kind TEXT,
    p_identity_hash TEXT,
    p_limit INTEGER,
    p_cooldown_minutes INTEGER[],
    p_window_ms INTEGER
)
RETURNS TABLE (
    retry_after_seconds INTEGER,
    new_failure_count INTEGER,
    new_escalation_level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_record RECORD;
    v_new_failure_count INTEGER;
    v_new_escalation_level INTEGER;
    v_new_blocked_until TIMESTAMPTZ := NULL;
    v_cooldown_min INTEGER;
BEGIN
    INSERT INTO auth_rate_limits (
        scope, identity_kind, identity_hash, failure_count, escalation_level, 
        window_started_at, last_attempt_at, expires_at
    )
    VALUES (
        p_scope, p_identity_kind, p_identity_hash, 1, 0, 
        v_now, v_now, v_now + (p_window_ms || ' milliseconds')::INTERVAL + interval '1 hour'
    )
    ON CONFLICT (scope, identity_kind, identity_hash)
    DO UPDATE SET
        failure_count = CASE 
            WHEN auth_rate_limits.window_started_at + (p_window_ms || ' milliseconds')::INTERVAL < v_now 
            THEN 1 
            ELSE auth_rate_limits.failure_count + 1 
        END,
        window_started_at = CASE 
            WHEN auth_rate_limits.window_started_at + (p_window_ms || ' milliseconds')::INTERVAL < v_now 
            THEN v_now 
            ELSE auth_rate_limits.window_started_at 
        END,
        last_attempt_at = v_now,
        updated_at = v_now,
        expires_at = v_now + interval '24 hours'
    RETURNING * INTO v_record;

    v_new_failure_count := v_record.failure_count;
    v_new_escalation_level := v_record.escalation_level;

    IF v_new_failure_count >= p_limit THEN
        -- Escalonamento progressivo
        v_cooldown_min := p_cooldown_minutes[LEAST(v_new_escalation_level + 1, array_length(p_cooldown_minutes, 1))];
        v_new_blocked_until := v_now + (v_cooldown_min || ' minutes')::INTERVAL;
        
        UPDATE auth_rate_limits
        SET blocked_until = v_new_blocked_until,
            escalation_level = escalation_level + 1,
            failure_count = 0, -- Reset count after block
            window_started_at = v_new_blocked_until
        WHERE id = v_record.id;
        
        RETURN QUERY SELECT ceil(extract(epoch from (v_new_blocked_until - v_now)))::INTEGER, 0, v_new_escalation_level + 1;
    ELSE
        RETURN QUERY SELECT 0, v_new_failure_count, v_new_escalation_level;
    END IF;
END;
$$;

-- 6. Função: Resetar após sucesso
CREATE OR REPLACE FUNCTION public.reset_auth_rate_limit(
    p_scope TEXT,
    p_identity_kind TEXT,
    p_identity_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM auth_rate_limits
    WHERE scope = p_scope
      AND identity_kind = p_identity_kind
      AND identity_hash = p_identity_hash;
END;
$$;

-- 7. Limpeza automática de registros expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_rate_limits()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM auth_rate_limits
    WHERE expires_at < now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_rate_limit_status(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_auth_failure(TEXT, TEXT, TEXT, INTEGER, INTEGER[], INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_auth_rate_limit(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_auth_rate_limits() TO service_role;

REVOKE ALL ON FUNCTION public.get_auth_rate_limit_status(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_auth_failure(TEXT, TEXT, TEXT, INTEGER, INTEGER[], INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_auth_rate_limit(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_auth_rate_limits() FROM PUBLIC, anon, authenticated;
