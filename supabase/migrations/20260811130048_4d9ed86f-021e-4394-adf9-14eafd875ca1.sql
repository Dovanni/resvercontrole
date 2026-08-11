CREATE OR REPLACE FUNCTION public.process_stripe_checkout_session_expired(
  p_provider_event_id text,
  p_provider_session_id text,
  p_event_created bigint,
  p_payload_sha256 text,
  p_livemode boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt_id uuid;
  v_empresa_id uuid;
  v_subscription_id uuid;
  v_status text;
  v_event_exists boolean;
BEGIN
  -- A. Rejeitar p_livemode=true
  IF p_livemode THEN
    RETURN 'livemode_rejected';
  END IF;

  -- B. Validar inputs
  IF p_provider_event_id IS NULL OR p_provider_event_id = '' THEN
    RETURN 'invalid_event_id';
  END IF;

  IF p_provider_session_id IS NULL OR NOT (p_provider_session_id LIKE 'cs_test_%') THEN
    RETURN 'invalid_session_id';
  END IF;

  IF p_event_created IS NULL OR p_event_created <= 0 THEN
    RETURN 'invalid_event_created';
  END IF;

  IF p_payload_sha256 IS NULL OR NOT (p_payload_sha256 ~ '^[0-9a-f]{64}$') THEN
    RETURN 'invalid_payload_hash';
  END IF;

  -- C. Localizar e Bloquear a Attempt (Autoridade da Linha)
  SELECT id, empresa_id, subscription_id, status
  INTO v_attempt_id, v_empresa_id, v_subscription_id, v_status
  FROM public.checkout_attempts
  WHERE provider = 'stripe'
    AND provider_checkout_session_id = p_provider_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'failed_retryable'; -- Attempt não localizada
  END IF;

  -- D. Validar integridade do evento se ele já existir
  SELECT EXISTS (
    SELECT 1 FROM public.payment_events
    WHERE provider = 'stripe'
      AND provider_event_id = p_provider_event_id
  ) INTO v_event_exists;

  -- E. Transição de Estado Idempotente (convergência)
  -- Se a tentativa está em estado inicial, convergir para expired INDEPENDENTE do evento ser novo ou duplicado
  IF v_status IN ('creating', 'open') THEN
    UPDATE public.checkout_attempts
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_attempt_id;
    v_status := 'expired';
  END IF;

  -- F. Tratamento de Retorno Baseado em Idempotência
  IF v_event_exists THEN
    RETURN 'duplicate';
  END IF;

  -- G. Se a tentativa já era terminal (paid/completed), ignoramos mutações
  IF v_status IN ('completed', 'paid', 'processed') THEN
    RETURN 'ignored_terminal';
  END IF;

  -- H. Se chegamos aqui, o evento é novo
  -- Registrar o Evento
  INSERT INTO public.payment_events (
    provider,
    provider_event_id,
    event_type,
    empresa_id,
    subscription_id,
    payload_sha256,
    processed_at
  ) VALUES (
    'stripe',
    p_provider_event_id,
    'checkout.session.expired',
    v_empresa_id,
    v_subscription_id,
    p_payload_sha256,
    now()
  );

  RETURN 'processed';

EXCEPTION WHEN OTHERS THEN
  RETURN 'internal_error';
END;
$function$;