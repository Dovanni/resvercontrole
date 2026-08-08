-- VEJAMAIS_BILLING_PHASE_1_COMPANY_SCOPED_FOUNDATION
-- Protocolo: 20260808212000_billing_foundation_phase_1.sql

BEGIN;

-- ETAPA 0: PRECONDIÇÕES
DO $$
DECLARE
    v_manifest_match boolean;
    v_f958_exists boolean;
    v_admin_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM private.manifests 
        WHERE incident_id = 'VEJAMAIS_MULTIEMPRESA_POST_ACTIVATION_F958_20260808'
        AND manifest_hash = '1dbeb0f241fbc4913854ed1d14751d25a308443f8f53f96d428b005b6f09af22'
    ) INTO v_manifest_match;

    SELECT EXISTS (
        SELECT 1 FROM public.empresas WHERE id = 'f958365e-3951-46e6-8595-e4f111115a90'
    ) INTO v_f958_exists;

    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_id = '1fcb4d6b-61bd-4af9-bf12-87c514094921' 
        AND empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90'
        AND role = 'admin'
    ) INTO v_admin_exists;

    IF NOT (v_manifest_match AND v_f958_exists AND v_admin_exists) THEN
        RAISE EXCEPTION 'PRECONDIÇÕES DIVERGENTES: manifest_match=%, f958_exists=%, admin_exists=%', 
            v_manifest_match, v_f958_exists, v_admin_exists;
    END IF;
END $$;

-- ETAPA 1: MODELO DE DADOS

-- 1. public.plans
CREATE TABLE IF NOT EXISTS public.plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    amount_cents integer NOT NULL CHECK (amount_cents >= 0),
    currency text NOT NULL DEFAULT 'BRL',
    billing_interval text CHECK (billing_interval IN ('month', 'year', NULL)),
    trial_days integer NOT NULL DEFAULT 0,
    grace_days integer NOT NULL DEFAULT 0,
    max_users integer NOT NULL,
    all_features_enabled boolean NOT NULL DEFAULT true,
    priority_suggestions boolean NOT NULL DEFAULT false,
    requires_payment_method boolean NOT NULL DEFAULT false,
    stripe_product_id text UNIQUE,
    stripe_price_id text UNIQUE,
    is_public boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone" ON public.plans
    FOR SELECT TO public USING (is_active = true AND is_public = true);

-- Inserir planos canônicos
INSERT INTO public.plans (code, name, amount_cents, currency, billing_interval, trial_days, grace_days, max_users, all_features_enabled, priority_suggestions, requires_payment_method, sort_order)
VALUES 
('essential_trial', 'Plano Essencial — Avaliação Gratuita', 0, 'BRL', NULL, 30, 5, 5, true, false, false, 1),
('enterprise_monthly', 'Plano Empresarial', 3590, 'BRL', 'month', 0, 5, 5, true, true, true, 2)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    amount_cents = EXCLUDED.amount_cents,
    max_users = EXCLUDED.max_users,
    trial_days = EXCLUDED.trial_days,
    grace_days = EXCLUDED.grace_days;

-- 2. public.subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id uuid NOT NULL REFERENCES public.empresas(id),
    plan_id uuid NOT NULL REFERENCES public.plans(id),
    status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'grace_read_only', 'restricted', 'incomplete', 'canceled')),
    source text NOT NULL CHECK (source IN ('onboarding', 'stripe', 'legacy', 'administrative')),
    trial_started_at timestamptz,
    trial_ends_at timestamptz,
    grace_ends_at timestamptz,
    current_period_started_at timestamptz,
    current_period_ends_at timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamptz,
    restricted_at timestamptz,
    stripe_customer_id text UNIQUE,
    stripe_subscription_id text UNIQUE,
    stripe_checkout_session_id text UNIQUE,
    last_payment_status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Constraint para impedir múltiplas assinaturas ativas por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_empresa 
ON public.subscriptions (empresa_id) 
WHERE status NOT IN ('canceled', 'incomplete');

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company subscription" ON public.subscriptions
    FOR SELECT TO authenticated
    USING (empresa_id IN (
        SELECT empresa_id FROM public.user_company_access WHERE user_id = auth.uid()
    ));

-- 3. public.payment_events (Server-only structure)
CREATE TABLE IF NOT EXISTS public.payment_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    provider_event_id text NOT NULL UNIQUE,
    event_type text NOT NULL,
    empresa_id uuid REFERENCES public.empresas(id),
    subscription_id uuid REFERENCES public.subscriptions(id),
    payload_sha256 text NOT NULL,
    processing_status text NOT NULL DEFAULT 'pending',
    processing_attempts integer NOT NULL DEFAULT 0,
    processed_at timestamptz,
    sanitized_error_code text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ETAPA 3: RPC DE LEITURA
CREATE OR REPLACE FUNCTION public.get_company_subscription_context(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_has_access boolean;
    v_sub record;
    v_plan record;
    v_user_count integer;
    v_access_mode text;
    v_days_remaining integer;
BEGIN
    v_user_id := auth.uid();
    
    -- Validar membership ativo
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_id = v_user_id AND empresa_id = p_empresa_id
    ) INTO v_has_access;
    
    IF NOT v_has_access THEN
        RETURN NULL;
    END IF;
    
    -- Buscar assinatura
    SELECT * INTO v_sub FROM public.subscriptions 
    WHERE empresa_id = p_empresa_id 
    AND status NOT IN ('canceled', 'incomplete')
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'plan_code', 'none',
            'status', 'none',
            'access_mode', 'restricted'
        );
    END IF;
    
    SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    
    -- Contar usuários ativos
    SELECT COUNT(*) INTO v_user_count FROM public.user_company_access WHERE empresa_id = p_empresa_id;
    
    -- Calcular dias restantes
    IF v_sub.status = 'trialing' THEN
        v_days_remaining := EXTRACT(DAY FROM (v_sub.trial_ends_at - now()))::integer;
        v_access_mode := 'full';
    ELSIF v_sub.status = 'active' THEN
        v_days_remaining := EXTRACT(DAY FROM (v_sub.current_period_ends_at - now()))::integer;
        v_access_mode := 'full';
    ELSIF v_sub.status IN ('past_due', 'grace_read_only') THEN
        v_days_remaining := EXTRACT(DAY FROM (v_sub.grace_ends_at - now()))::integer;
        v_access_mode := 'read_only';
    ELSIF v_sub.status = 'restricted' THEN
        v_days_remaining := 0;
        v_access_mode := 'billing_export_support_only';
    ELSE
        v_access_mode := 'billing_only';
    END IF;

    RETURN jsonb_build_object(
        'plan_code', v_plan.code,
        'plan_name', v_plan.name,
        'status', v_sub.status,
        'trial_started_at', v_sub.trial_started_at,
        'trial_ends_at', v_sub.trial_ends_at,
        'grace_ends_at', v_sub.grace_ends_at,
        'current_period_ends_at', v_sub.current_period_ends_at,
        'days_remaining', GREATEST(0, v_days_remaining),
        'access_mode', v_access_mode,
        'max_users', v_plan.max_users,
        'current_user_count', v_user_count,
        'can_invite_member', (v_user_count < v_plan.max_users),
        'priority_suggestions', v_plan.priority_suggestions
    );
END;
$$;

-- ETAPA 4: TRIAL DA F958
DO $$
DECLARE
    v_f958_id uuid := 'f958365e-3951-46e6-8595-e4f111115a90';
    v_onboarding_id uuid := 'fccca265-444e-4473-b26e-f52debeafd41';
    v_trial_plan_id uuid;
    v_activated_at timestamptz;
BEGIN
    SELECT id INTO v_trial_plan_id FROM public.plans WHERE code = 'essential_trial';
    
    SELECT updated_at INTO v_activated_at FROM public.pending_onboardings WHERE id = v_onboarding_id;
    
    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE empresa_id = v_f958_id) THEN
        INSERT INTO public.subscriptions (
            empresa_id, plan_id, status, source, 
            trial_started_at, trial_ends_at, grace_ends_at,
            current_period_started_at, current_period_ends_at
        ) VALUES (
            v_f958_id, v_trial_plan_id, 'trialing', 'onboarding',
            v_activated_at, v_activated_at + interval '30 days', v_activated_at + interval '35 days',
            v_activated_at, v_activated_at + interval '30 days'
        );
    END IF;
END $$;

-- ETAPA 5: LIMITE DE USUÁRIOS
CREATE OR REPLACE FUNCTION public.can_company_invite_member(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
    v_sub_ctx jsonb;
    v_current_count integer;
    v_limit integer;
BEGIN
    v_user_id := auth.uid();
    
    -- Exigir membership admin ativo
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_id = v_user_id AND empresa_id = p_empresa_id AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('allowed', false, 'message', 'Somente administradores podem convidar membros.');
    END IF;
    
    v_sub_ctx := public.get_company_subscription_context(p_empresa_id);
    v_current_count := (v_sub_ctx->>'current_user_count')::integer;
    v_limit := (v_sub_ctx->>'max_users')::integer;
    
    IF v_current_count >= v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'current', v_current_count, 
            'limit', v_limit,
            'message', 'Limite de ' || v_limit || ' usuários atingido para seu plano atual.'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'allowed', true, 
        'current', v_current_count, 
        'limit', v_limit,
        'message', 'Você ainda pode convidar ' || (v_limit - v_current_count) || ' membros.'
    );
END;
$$;

COMMIT;
