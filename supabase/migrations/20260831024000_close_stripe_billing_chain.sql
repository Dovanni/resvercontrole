-- VEJAMAIS: close commercial billing chain without changing institutional matrix
BEGIN;

-- Canonical commercial catalog. Stripe IDs remain environment-owned; do not guess them here.
INSERT INTO public.plans (
  code, name, description, amount_cents, currency, billing_interval,
  trial_days, grace_days, max_users, all_features_enabled,
  priority_suggestions, requires_payment_method, is_public, is_active, sort_order, updated_at
)
VALUES
  (
    'essential_trial', 'Essencial — Avaliação Gratuita',
    'Acesso completo por 30 dias antes da contratação do Plano Empresarial.',
    0, 'BRL', NULL, 30, 5, 5, true, false, false, false, true, 1, now()
  ),
  (
    'enterprise_monthly', 'Plano Empresarial',
    'Plano Empresarial VEJAMAIS ERP — cobrança recorrente mensal.',
    3590, 'BRL', 'month', 0, 5, 5, true, true, true, true, true, 2, now()
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount_cents = EXCLUDED.amount_cents,
  currency = EXCLUDED.currency,
  billing_interval = EXCLUDED.billing_interval,
  trial_days = EXCLUDED.trial_days,
  grace_days = EXCLUDED.grace_days,
  max_users = EXCLUDED.max_users,
  all_features_enabled = EXCLUDED.all_features_enabled,
  priority_suggestions = EXCLUDED.priority_suggestions,
  requires_payment_method = EXCLUDED.requires_payment_method,
  is_public = EXCLUDED.is_public,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Idempotent provisioning of one commercial trial per company.
CREATE OR REPLACE FUNCTION public.ensure_commercial_trial_subscription(
  p_empresa_id uuid,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_billing_mode text;
  v_existing_id uuid;
  v_trial_plan_id uuid;
  v_company_created_at timestamptz;
  v_onboarding_completed_at timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_status text;
BEGIN
  SELECT billing_mode, created_at,
         CASE
           WHEN configuracoes ? 'onboarding_completed_at'
           THEN NULLIF(configuracoes->>'onboarding_completed_at', '')::timestamptz
           ELSE NULL
         END
    INTO v_billing_mode, v_company_created_at, v_onboarding_completed_at
  FROM public.empresas
  WHERE id = p_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND';
  END IF;

  -- Hard boundary: institutional matrix never enters the commercial Stripe chain.
  IF v_billing_mode <> 'commercial' THEN
    RETURN NULL;
  END IF;

  -- Never grant a second trial, even if an older subscription is canceled.
  SELECT id INTO v_existing_id
  FROM public.subscriptions
  WHERE empresa_id = p_empresa_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT id INTO v_trial_plan_id
  FROM public.plans
  WHERE code = 'essential_trial' AND is_active = true
  LIMIT 1;

  IF v_trial_plan_id IS NULL THEN
    RAISE EXCEPTION 'ESSENTIAL_TRIAL_PLAN_NOT_FOUND';
  END IF;

  v_start := COALESCE(p_started_at, v_onboarding_completed_at, v_company_created_at, now());
  v_end := v_start + interval '30 days';
  v_status := CASE WHEN v_end > now() THEN 'trialing' ELSE 'restricted' END;

  INSERT INTO public.subscriptions (
    empresa_id, plan_id, status, source,
    trial_started_at, trial_ends_at, grace_ends_at,
    current_period_started_at, current_period_ends_at,
    cancel_at_period_end, created_at, updated_at
  ) VALUES (
    p_empresa_id, v_trial_plan_id, v_status, 'onboarding',
    v_start, v_end, v_end + interval '5 days',
    v_start, v_end,
    false, now(), now()
  )
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_commercial_trial_subscription(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_commercial_trial_subscription(uuid, timestamptz) TO service_role;

-- Backfill only commercial companies that have never had a subscription.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT e.id, COALESCE(
      CASE WHEN e.configuracoes ? 'onboarding_completed_at'
           THEN NULLIF(e.configuracoes->>'onboarding_completed_at', '')::timestamptz END,
      e.created_at
    ) AS started_at
    FROM public.empresas e
    WHERE e.billing_mode = 'commercial'
      AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.empresa_id = e.id)
  LOOP
    PERFORM public.ensure_commercial_trial_subscription(r.id, r.started_at);
  END LOOP;
END $$;

-- Preserve the existing onboarding architecture and append commercial trial provisioning.
CREATE OR REPLACE FUNCTION public.finalize_user_onboarding(p_auth_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_onboarding public.pending_onboardings%ROWTYPE;
  v_empresa_id uuid;
  v_existing_owner uuid;
  v_email text;
  v_onboarding_count integer;
  v_repair_activated boolean := false;
BEGIN
  SELECT lower(trim(u.email)) INTO v_email
  FROM auth.users u WHERE u.id = p_auth_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'AUTH_USER_NOT_FOUND'; END IF;

  SELECT count(*) INTO v_onboarding_count
  FROM public.pending_onboardings p
  WHERE p.auth_user_id = p_auth_user_id AND p.status = 'pending' AND p.expires_at > now();

  IF v_onboarding_count = 0 THEN
    SELECT uca.empresa_id INTO v_empresa_id
    FROM public.user_company_access uca
    WHERE uca.user_id = p_auth_user_id AND uca.status = 'active'
    ORDER BY uca.is_primary DESC NULLS LAST, uca.created_at ASC LIMIT 1;

    IF v_empresa_id IS NOT NULL THEN
      UPDATE public.profiles SET empresa_id = v_empresa_id, email = coalesce(email, v_email), updated_at = now()
      WHERE id = p_auth_user_id AND empresa_id IS DISTINCT FROM v_empresa_id;
      PERFORM public.ensure_commercial_trial_subscription(v_empresa_id, NULL);
      RETURN jsonb_build_object('success', true, 'already_finalized', true, 'empresa_id', v_empresa_id);
    END IF;

    SELECT * INTO v_onboarding
    FROM public.pending_onboardings p
    WHERE p.auth_user_id = p_auth_user_id AND p.status = 'activated'
    ORDER BY p.updated_at DESC, p.created_at DESC LIMIT 1;

    IF FOUND THEN v_repair_activated := true;
    ELSE RAISE EXCEPTION 'NO_VALID_PENDING_ONBOARDING';
    END IF;
  ELSIF v_onboarding_count > 1 THEN
    RAISE EXCEPTION 'MULTIPLE_PENDING_ONBOARDINGS';
  ELSE
    SELECT * INTO v_onboarding
    FROM public.pending_onboardings p
    WHERE p.auth_user_id = p_auth_user_id AND p.status = 'pending' AND p.expires_at > now()
    FOR UPDATE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(v_onboarding.cnpj_limpo, v_onboarding.id::text), 0));

  SELECT e.id, e.owner_id INTO v_empresa_id, v_existing_owner
  FROM public.empresas e
  WHERE upper(regexp_replace(coalesce(e.documento, ''), '[^A-Za-z0-9]', '', 'g')) = v_onboarding.cnpj_limpo
  ORDER BY e.created_at ASC LIMIT 1 FOR UPDATE;

  IF v_empresa_id IS NOT NULL AND v_existing_owner <> p_auth_user_id THEN
    RAISE EXCEPTION 'COMPANY_ALREADY_EXISTS';
  END IF;

  IF v_empresa_id IS NULL THEN
    IF v_repair_activated THEN RAISE EXCEPTION 'ACTIVATED_ONBOARDING_WITHOUT_COMPANY'; END IF;
    INSERT INTO public.empresas (nome, documento, owner_id, status, razao_social, configuracoes)
    VALUES (v_onboarding.nome_empresa, v_onboarding.cnpj_limpo, p_auth_user_id, 'active', v_onboarding.nome_empresa,
            jsonb_build_object('onboarding_completed_at', now()))
    RETURNING id INTO v_empresa_id;
  END IF;

  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'ONBOARDING_WITHOUT_COMPANY'; END IF;

  INSERT INTO public.profiles (id, full_name, business_name, email, empresa_id, updated_at)
  VALUES (p_auth_user_id, v_onboarding.nome_admin, v_onboarding.nome_empresa, v_email, v_empresa_id, now())
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, business_name = EXCLUDED.business_name,
    email = EXCLUDED.email, empresa_id = EXCLUDED.empresa_id, updated_at = now();

  INSERT INTO public.user_roles (user_id, role) VALUES (p_auth_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_company_access (user_id, empresa_id, role, status, is_primary)
  VALUES (p_auth_user_id, v_empresa_id, 'admin', 'active', true)
  ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = 'admin', status = 'active', is_primary = true;

  PERFORM public.ensure_empresa_defaults(v_empresa_id, p_auth_user_id);
  PERFORM public.ensure_commercial_trial_subscription(v_empresa_id, NULL);

  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = p_auth_user_id AND uca.empresa_id = v_empresa_id AND uca.status = 'active'
  ) THEN RAISE EXCEPTION 'ONBOARDING_ACCESS_LINK_FAILED'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_auth_user_id AND p.empresa_id = v_empresa_id
  ) THEN RAISE EXCEPTION 'ONBOARDING_PROFILE_LINK_FAILED'; END IF;

  IF NOT v_repair_activated THEN
    UPDATE public.pending_onboardings SET status = 'activated', updated_at = now() WHERE id = v_onboarding.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_finalized', v_repair_activated,
                            'reconciled', v_repair_activated, 'empresa_id', v_empresa_id,
                            'onboarding_id', v_onboarding.id);
END;
$$;

-- Billing context: institutional remains permanent; expired commercial trial becomes billing-only.
CREATE OR REPLACE FUNCTION public.get_company_subscription_context_admin(p_empresa_id uuid, p_verified_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_has_access boolean;
  v_billing_mode text;
  v_sub record;
  v_plan record;
  v_user_count integer;
  v_access_mode text;
  v_effective_status text;
  v_days_remaining integer;
BEGIN
  IF p_empresa_id IS NULL OR p_verified_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters: p_empresa_id and p_verified_user_id are mandatory.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = p_verified_user_id AND empresa_id = p_empresa_id AND status = 'active'
  ) INTO v_has_access;
  IF NOT v_has_access THEN RETURN NULL; END IF;

  SELECT billing_mode INTO v_billing_mode FROM public.empresas WHERE id = p_empresa_id;
  SELECT COUNT(*)::integer INTO v_user_count FROM public.user_company_access
  WHERE empresa_id = p_empresa_id AND status = 'active';

  IF v_billing_mode = 'institutional' THEN
    RETURN jsonb_build_object(
      'billing_mode','institutional','plan_code','institutional_matrix',
      'plan_name','Matriz VEJAMAIS — Acesso Institucional Permanente','status','active',
      'trial_started_at',NULL,'trial_ends_at',NULL,'grace_ends_at',NULL,'current_period_ends_at',NULL,
      'days_remaining',0,'access_mode','full','max_users',2147483647,
      'current_user_count',v_user_count,'can_invite_member',true,'priority_suggestions',true
    );
  END IF;

  SELECT plan_id,status,trial_started_at,trial_ends_at,grace_ends_at,
         current_period_started_at,current_period_ends_at
  INTO v_sub
  FROM public.subscriptions
  WHERE empresa_id = p_empresa_id AND status NOT IN ('canceled','incomplete')
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'billing_mode','commercial','plan_code','none','plan_name','Nenhum','status','none',
      'access_mode','restricted','days_remaining',0,'current_user_count',v_user_count,
      'max_users',0,'can_invite_member',false,'priority_suggestions',false
    );
  END IF;

  SELECT code,name,max_users,priority_suggestions INTO v_plan
  FROM public.plans WHERE id = v_sub.plan_id;

  v_effective_status := v_sub.status;
  IF v_sub.status = 'trialing' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at <= now() THEN
    v_effective_status := 'restricted';
  END IF;

  IF v_effective_status = 'trialing' THEN
    v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.trial_ends_at - now())) / 86400.0)::integer);
    v_access_mode := 'full';
  ELSIF v_effective_status = 'active' THEN
    v_days_remaining := CASE WHEN v_sub.current_period_ends_at IS NULL THEN 0
      ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.current_period_ends_at - now())) / 86400.0)::integer) END;
    v_access_mode := 'full';
  ELSIF v_effective_status IN ('past_due','grace_read_only') THEN
    v_days_remaining := CASE WHEN v_sub.grace_ends_at IS NULL THEN 0
      ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_sub.grace_ends_at - now())) / 86400.0)::integer) END;
    v_access_mode := 'read_only';
  ELSIF v_effective_status = 'restricted' THEN
    v_days_remaining := 0;
    v_access_mode := 'billing_only';
  ELSE
    v_days_remaining := 0;
    v_access_mode := 'restricted';
  END IF;

  RETURN jsonb_build_object(
    'billing_mode','commercial','plan_code',v_plan.code,'plan_name',v_plan.name,
    'status',v_effective_status,'trial_started_at',v_sub.trial_started_at,'trial_ends_at',v_sub.trial_ends_at,
    'grace_ends_at',v_sub.grace_ends_at,
    'current_period_ends_at',COALESCE(v_sub.current_period_ends_at,v_sub.trial_ends_at),
    'days_remaining',v_days_remaining,'access_mode',v_access_mode,'max_users',v_plan.max_users,
    'current_user_count',v_user_count,
    'can_invite_member',(v_user_count < v_plan.max_users AND v_access_mode = 'full'),
    'priority_suggestions',v_plan.priority_suggestions
  );
END;
$$;

-- State guard for processed payment failure events. Institutional companies are excluded.
CREATE OR REPLACE FUNCTION public.apply_processed_stripe_payment_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_grace_days integer := 5;
BEGIN
  IF NEW.provider <> 'stripe' OR NEW.processing_status <> 'processed' OR NEW.subscription_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.empresas e ON e.id = s.empresa_id
    WHERE s.id = NEW.subscription_id AND e.billing_mode = 'commercial'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type = 'invoice.payment_failed' THEN
    SELECT COALESCE(p.grace_days, 5) INTO v_grace_days
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.id = NEW.subscription_id;

    UPDATE public.subscriptions
    SET status = 'past_due',
        source = 'stripe',
        last_payment_status = 'failed',
        grace_ends_at = now() + make_interval(days => COALESCE(v_grace_days, 5)),
        updated_at = now()
    WHERE id = NEW.subscription_id AND status <> 'canceled';
  ELSIF NEW.event_type IN (
    'checkout.session.completed','customer.subscription.created','customer.subscription.updated','invoice.paid'
  ) THEN
    UPDATE public.subscriptions SET source = 'stripe', updated_at = now()
    WHERE id = NEW.subscription_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_processed_stripe_payment_state ON public.payment_events;
CREATE TRIGGER trg_apply_processed_stripe_payment_state
AFTER INSERT OR UPDATE OF processing_status, subscription_id ON public.payment_events
FOR EACH ROW EXECUTE FUNCTION public.apply_processed_stripe_payment_state();

COMMIT;
