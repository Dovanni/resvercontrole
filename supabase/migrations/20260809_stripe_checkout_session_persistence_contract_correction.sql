-- 1. Create or replace the RPC
CREATE OR REPLACE FUNCTION public.finalize_checkout_attempt_v2(
  p_attempt_id uuid,
  p_provider text,
  p_provider_checkout_session_id text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count int;
  v_empresa_id uuid;
  v_subscription_id uuid;
  v_current_status text;
  v_current_provider_session_id text;
BEGIN
  -- 1. Input validation
  IF p_attempt_id IS NULL OR p_provider IS NULL OR p_provider_checkout_session_id IS NULL OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'Parameters cannot be null';
  END IF;

  IF p_provider <> 'stripe' THEN
    RAISE EXCEPTION 'Invalid provider. Only stripe is supported.';
  END IF;

  IF p_provider_checkout_session_id = '' THEN
    RAISE EXCEPTION 'Provider session ID cannot be empty';
  END IF;

  -- 2. Lock attempt and derive context
  SELECT empresa_id, subscription_id, status, provider_checkout_session_id
  INTO v_empresa_id, v_subscription_id, v_current_status, v_current_provider_session_id
  FROM public.checkout_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout attempt not found';
  END IF;

  -- 3. Validate internal subscription belongs to the company
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE id = v_subscription_id AND empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Internal subscription mismatch';
  END IF;

  -- 4. State machine validation
  -- a. status='creating' and session_id null
  -- b. status='open' and session_id null (reconciliation case)
  -- c. status='open' with same session_id (idempotency)
  
  IF v_current_status = 'creating' AND v_current_provider_session_id IS NULL THEN
    -- Normal flow: first finalization
    NULL;
  ELSIF v_current_status = 'open' AND v_current_provider_session_id IS NULL THEN
    -- Reconciliation flow: existing open attempt without ID
    NULL;
  ELSIF v_current_status = 'open' AND v_current_provider_session_id = p_provider_checkout_session_id THEN
    -- Idempotency flow
    RETURN jsonb_build_object(
      'persisted', true,
      'attempt_id', p_attempt_id,
      'status', 'open',
      'provider_session_id_present', true
    );
  ELSE
    RAISE EXCEPTION 'Invalid state transition: status=%, session_id_present=%', v_current_status, (v_current_provider_session_id IS NOT NULL);
  END IF;

  -- 5. Atomic Update
  UPDATE public.checkout_attempts
  SET
    provider = p_provider,
    provider_checkout_session_id = p_provider_checkout_session_id,
    expires_at = p_expires_at,
    status = 'open',
    updated_at = now()
  WHERE id = p_attempt_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'Failed to update checkout attempt: row count %', v_row_count;
  END IF;

  RETURN jsonb_build_object(
    'persisted', true,
    'attempt_id', p_attempt_id,
    'status', 'open',
    'provider_session_id_present', true
  );
END;
$$;

-- 2. Configure permissions
ALTER FUNCTION public.finalize_checkout_attempt_v2(uuid, text, text, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finalize_checkout_attempt_v2(uuid, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_checkout_attempt_v2(uuid, text, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_checkout_attempt_v2(uuid, text, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_checkout_attempt_v2(uuid, text, text, timestamptz) TO service_role;

-- 3. Uniqueness constraint
-- Note: status open without session_id check will be added AFTER reconciliation
ALTER TABLE public.checkout_attempts
ADD CONSTRAINT checkout_attempts_provider_session_unique UNIQUE (provider, provider_checkout_session_id);
