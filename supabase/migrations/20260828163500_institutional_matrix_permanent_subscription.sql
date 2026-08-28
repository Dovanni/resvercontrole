BEGIN;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'commercial';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'empresas_billing_mode_check'
      AND conrelid = 'public.empresas'::regclass
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_billing_mode_check
      CHECK (billing_mode IN ('commercial','institutional'));
  END IF;
END $$;

UPDATE public.empresas
SET billing_mode = 'institutional', updated_at = now()
WHERE id = '8cdb1529-b51f-4d52-b7eb-da0c6badeed6';

INSERT INTO public.plans (
  code, name, description, amount_cents, currency, billing_interval,
  trial_days, grace_days, max_users, all_features_enabled,
  priority_suggestions, requires_payment_method, is_public, is_active, sort_order
)
VALUES (
  'institutional_matrix',
  'Matriz VEJAMAIS — Acesso Institucional Permanente',
  'Acesso institucional permanente, sem cobrança e sem prazo de vencimento.',
  0, 'BRL', NULL,
  0, 0, 2147483647, true,
  true, false, false, true, 0
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount_cents = 0,
  billing_interval = NULL,
  trial_days = 0,
  grace_days = 0,
  max_users = 2147483647,
  all_features_enabled = true,
  priority_suggestions = true,
  requires_payment_method = false,
  is_public = false,
  is_active = true,
  updated_at = now();

DO $$
DECLARE
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id
  FROM public.plans
  WHERE code = 'institutional_matrix';

  UPDATE public.subscriptions
  SET plan_id = v_plan_id,
      status = 'active',
      source = 'administrative',
      trial_started_at = NULL,
      trial_ends_at = NULL,
      grace_ends_at = NULL,
      current_period_started_at = NULL,
      current_period_ends_at = NULL,
      cancel_at_period_end = false,
      canceled_at = NULL,
      restricted_at = NULL,
      stripe_customer_id = NULL,
      stripe_subscription_id = NULL,
      stripe_checkout_session_id = NULL,
      last_payment_status = NULL,
      updated_at = now()
  WHERE empresa_id = '8cdb1529-b51f-4d52-b7eb-da0c6badeed6'
    AND status NOT IN ('canceled','incomplete');

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      empresa_id, plan_id, status, source,
      trial_started_at, trial_ends_at, grace_ends_at,
      current_period_started_at, current_period_ends_at,
      cancel_at_period_end
    ) VALUES (
      '8cdb1529-b51f-4d52-b7eb-da0c6badeed6',
      v_plan_id,
      'active',
      'administrative',
      NULL, NULL, NULL, NULL, NULL, false
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_company_subscription_context_admin(
    p_empresa_id uuid,
    p_verified_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_has_access boolean;
    v_billing_mode text;
    v_sub record;
    v_plan record;
    v_user_count integer;
    v_access_mode text;
    v_days_remaining integer;
BEGIN
    IF p_empresa_id IS NULL OR p_verified_user_id IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters: p_empresa_id and p_verified_user_id are mandatory.';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.user_company_access
        WHERE user_id = p_verified_user_id
          AND empresa_id = p_empresa_id
          AND status = 'active'
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RETURN NULL;
    END IF;

    SELECT billing_mode
      INTO v_billing_mode
    FROM public.empresas
    WHERE id = p_empresa_id;

    SELECT COUNT(*)::integer
      INTO v_user_count
    FROM public.user_company_access
    WHERE empresa_id = p_empresa_id
      AND status = 'active';

    IF v_billing_mode = 'institutional' THEN
        RETURN jsonb_build_object(
            'billing_mode', 'institutional',
            'plan_code', 'institutional_matrix',
            'plan_name', 'Matriz VEJAMAIS — Acesso Institucional Permanente',
            'status', 'active',
            'trial_started_at', NULL,
            'trial_ends_at', NULL,
            'grace_ends_at', NULL,
            'current_period_ends_at', NULL,
            'days_remaining', 0,
            'access_mode', 'full',
            'max_users', 2147483647,
            'current_user_count', v_user_count,
            'can_invite_member', true,
            'priority_suggestions', true
        );
    END IF;

    SELECT
        plan_id,
        status,
        trial_started_at,
        trial_ends_at,
        grace_ends_at,
        current_period_started_at,
        current_period_ends_at
    INTO v_sub
    FROM public.subscriptions
    WHERE empresa_id = p_empresa_id
      AND status NOT IN ('canceled', 'incomplete')
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'billing_mode', 'commercial',
            'plan_code', 'none',
            'plan_name', 'Nenhum',
            'status', 'none',
            'access_mode', 'restricted',
            'days_remaining', 0,
            'current_user_count', v_user_count,
            'max_users', 0,
            'can_invite_member', false,
            'priority_suggestions', false
        );
    END IF;

    SELECT code, name, max_users, priority_suggestions
      INTO v_plan
    FROM public.plans
    WHERE id = v_sub.plan_id;

    IF v_sub.status = 'trialing' THEN
        v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.trial_ends_at - now()))::integer);
        v_access_mode := 'full';
    ELSIF v_sub.status = 'active' THEN
        v_days_remaining := CASE
          WHEN v_sub.current_period_ends_at IS NULL THEN 0
          ELSE GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_ends_at - now()))::integer)
        END;
        v_access_mode := 'full';
    ELSIF v_sub.status IN ('past_due', 'grace_read_only') THEN
        v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.grace_ends_at - now()))::integer);
        v_access_mode := 'read_only';
    ELSIF v_sub.status = 'restricted' THEN
        v_days_remaining := 0;
        v_access_mode := 'billing_only';
    ELSE
        v_days_remaining := 0;
        v_access_mode := 'restricted';
    END IF;

    RETURN jsonb_build_object(
        'billing_mode', 'commercial',
        'plan_code', v_plan.code,
        'plan_name', v_plan.name,
        'status', v_sub.status,
        'trial_started_at', v_sub.trial_started_at,
        'trial_ends_at', v_sub.trial_ends_at,
        'grace_ends_at', v_sub.grace_ends_at,
        'current_period_ends_at', COALESCE(v_sub.current_period_ends_at, v_sub.trial_ends_at),
        'days_remaining', v_days_remaining,
        'access_mode', v_access_mode,
        'max_users', v_plan.max_users,
        'current_user_count', v_user_count,
        'can_invite_member', (v_user_count < v_plan.max_users AND v_access_mode = 'full'),
        'priority_suggestions', v_plan.priority_suggestions
    );
END;
$function$;

ALTER FUNCTION public.get_company_subscription_context_admin(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_company_subscription_context_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_subscription_context_admin(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
