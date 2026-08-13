-- PROTOCOLO: VEJAMAIS_STRIPE_CREATING_ATTEMPT_ATOMIC_RECOVERY_IMPLEMENTATION
-- OBJETIVO: Implementar RPC de recuperação segura para tentativas presas em 'creating'

CREATE OR REPLACE FUNCTION public.recovery_checkout_attempt(
    p_attempt_id UUID,
    p_empresa_id UUID,
    p_verified_user_id UUID
)
RETURNS public.checkout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt public.checkout_attempts;
BEGIN
    -- 1. Validação de Acesso (Ownership & Admin)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE empresa_id = p_empresa_id AND user_id = p_verified_user_id 
          AND status = 'active' AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Forbidden: Admin membership required';
    END IF;

    -- 2. Localizar e Lockar tentativa específica
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE id = p_attempt_id 
      AND empresa_id = p_empresa_id
      AND status = 'creating'
    FOR UPDATE;

    IF v_attempt.id IS NULL THEN
        RAISE EXCEPTION 'Attempt not found or not in creating status';
    END IF;

    -- 3. Transição Atômica para 'failed' (com reason_code de recuperação)
    -- Isso libera o slot único (idx_checkout_attempts_active_per_sub)
    UPDATE public.checkout_attempts
    SET 
        status = 'failed',
        reason_code = 'RECOVERY_TRIGGERED',
        updated_at = now()
    WHERE id = p_attempt_id
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recovery_checkout_attempt(UUID, UUID, UUID) TO service_role;
