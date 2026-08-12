-- PROTOCOLO: VEJAMAIS_STRIPE_CHECKOUT_ATTEMPT_TEST_LIVE_ISOLATION_TARGETED_CORRECTION
-- OBJETIVO: Isolar slots de checkout entre ambientes Test/Live

-- 1. Adicionar coluna livemode
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkout_attempts' AND column_name = 'livemode') THEN
        ALTER TABLE public.checkout_attempts ADD COLUMN livemode BOOLEAN;
    END IF;
END $$;

-- 2. Backfill comprovável (cs_test_ -> false, cs_live_ -> true)
UPDATE public.checkout_attempts
SET livemode = false
WHERE provider_checkout_session_id LIKE 'cs_test_%' AND livemode IS NULL;

UPDATE public.checkout_attempts
SET livemode = true
WHERE provider_checkout_session_id LIKE 'cs_live_%' AND livemode IS NULL;

-- Registros sem provider_session_id (ex: presos em 'creating') 
-- mas que são de assinaturas que só operaram em teste até agora.
-- Como estamos em transição controlada, assumimos false para o que sobrou
-- se não houver prova de live.
UPDATE public.checkout_attempts
SET livemode = false
WHERE livemode IS NULL;

-- 3. Tornar obrigatório
ALTER TABLE public.checkout_attempts ALTER COLUMN livemode SET NOT NULL;

-- 4. Reconstruir Unicidade
DROP INDEX IF EXISTS public.idx_checkout_attempts_active_per_sub;

CREATE UNIQUE INDEX idx_checkout_attempts_active_per_sub 
ON public.checkout_attempts (empresa_id, subscription_id, livemode) 
WHERE (status IN ('creating', 'open'));

-- 5. Atualizar RPC reserve_checkout_attempt
CREATE OR REPLACE FUNCTION public.reserve_checkout_attempt(
    p_empresa_id UUID,
    p_subscription_id UUID,
    p_verified_user_id UUID,
    p_livemode BOOLEAN,
    p_provider TEXT DEFAULT 'stripe'
)
RETURNS public.checkout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt public.checkout_attempts;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- VALIDATION (Membership & Sub Ownership)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE empresa_id = p_empresa_id AND user_id = p_verified_user_id 
          AND status = 'active' AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Forbidden: Admin membership required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.subscriptions 
        WHERE id = p_subscription_id AND empresa_id = p_empresa_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: Subscription mismatch';
    END IF;

    -- 1. Lock and check for existing valid attempt in the SAME environment
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE empresa_id = p_empresa_id 
      AND subscription_id = p_subscription_id
      AND livemode = p_livemode
      AND status IN ('creating', 'open')
      AND (expires_at IS NULL OR expires_at > v_now)
    FOR UPDATE;

    IF v_attempt.id IS NOT NULL THEN
        RETURN v_attempt;
    END IF;

    -- 2. Create new attempt
    INSERT INTO public.checkout_attempts (
        provider,
        empresa_id,
        subscription_id,
        created_by_user_id,
        livemode,
        idempotency_key,
        status,
        expires_at
    )
    VALUES (
        p_provider,
        p_empresa_id,
        p_subscription_id,
        p_verified_user_id,
        p_livemode,
        gen_random_uuid()::text,
        'creating',
        v_now + interval '24 hours'
    )
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_checkout_attempt(UUID, UUID, UUID, BOOLEAN, TEXT) TO service_role;
