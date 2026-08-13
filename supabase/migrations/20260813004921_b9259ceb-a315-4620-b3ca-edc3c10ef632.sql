
-- Apply the already created migration remotely
CREATE OR REPLACE FUNCTION public.fail_checkout_attempt_initialization(
    p_attempt_id UUID,
    p_empresa_id UUID,
    p_subscription_id UUID,
    p_livemode BOOLEAN,
    p_expected_updated_at TIMESTAMPTZ,
    p_reason_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt public.checkout_attempts;
    v_reason_allowlist TEXT[] := ARRAY[
        'STRIPE_CLIENT_KEY_MISSING',
        'STRIPE_CLIENT_KEY_FORMAT_INVALID',
        'STRIPE_CLIENT_KEY_MODE_MISMATCH',
        'STRIPE_CLIENT_CONSTRUCTION_FAILED',
        'STRIPE_REQUEST_PREPARATION_FAILED'
    ];
BEGIN
    -- 1. Reason Code Validation
    IF NOT (p_reason_code = ANY(v_reason_allowlist)) THEN
        RAISE EXCEPTION 'Forbidden: Invalid reason_code for local failure compensation';
    END IF;

    -- 3. Atomic Lock and Compare-and-Set
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE id = p_attempt_id
      AND empresa_id = p_empresa_id
      AND subscription_id = p_subscription_id
      AND livemode = p_livemode
    FOR UPDATE;

    IF v_attempt.id IS NULL THEN
        RETURN 'not_found';
    END IF;

    -- Eligibility check
    IF v_attempt.status <> 'creating' THEN
        RETURN 'already_terminal';
    END IF;

    IF v_attempt.provider_checkout_session_id IS NOT NULL THEN
        RETURN 'not_eligible'; -- Already reached Stripe (or claimed to)
    END IF;

    -- Concurrency check
    IF v_attempt.updated_at <> p_expected_updated_at THEN
        RETURN 'conflict';
    END IF;

    -- 4. Finalize Failure
    UPDATE public.checkout_attempts
    SET 
        status = 'failed',
        last_error_code = p_reason_code,
        updated_at = now()
    WHERE id = p_attempt_id;

    RETURN 'failed';
END;
$$;

-- Ownership and Permissions
REVOKE ALL ON FUNCTION public.fail_checkout_attempt_initialization(UUID, UUID, UUID, BOOLEAN, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_checkout_attempt_initialization(UUID, UUID, UUID, BOOLEAN, TIMESTAMPTZ, TEXT) TO service_role;
