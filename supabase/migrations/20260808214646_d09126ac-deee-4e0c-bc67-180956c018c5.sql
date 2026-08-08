-- PROTOCOLO: VEJAMAIS_BILLING_PHASE_1_SUBSCRIPTION_CONTEXT_TARGETED_ACL_CORRECTION
-- Correção direcionada da RPC para restaurar funcionamento sob sessão authenticated.

BEGIN;

-- 1. Inspecionar e corrigir a propriedade da função
-- Garantir que a função pertença ao postgres (proprietário privilegiado)
ALTER FUNCTION public.get_company_subscription_context(uuid) OWNER TO postgres;

-- 2. Atualizar a definição da função com nomes qualificados e segurança reforçada
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
    -- Derive a identidade exclusivamente por auth.uid()
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Validar membership active da empresa solicitada (Isolamento de Tenant)
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_id = v_user_id 
          AND empresa_id = p_empresa_id
          AND status = 'active'
    ) INTO v_has_access;
    
    -- Falhar de forma segura em acesso cruzado ou ausência de vínculo
    IF NOT v_has_access THEN
        RETURN NULL;
    END IF;
    
    -- Buscar assinatura ativa (Nomes totalmente qualificados)
    SELECT plan_id, status, trial_started_at, trial_ends_at, grace_ends_at, current_period_started_at, current_period_ends_at 
    INTO v_sub 
    FROM public.subscriptions 
    WHERE empresa_id = p_empresa_id 
    AND status NOT IN ('canceled', 'incomplete')
    LIMIT 1;
    
    -- Assinatura realmente ausente
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'plan_code', 'none',
            'status', 'none',
            'access_mode', 'restricted'
        );
    END IF;
    
    -- Buscar dados do plano (Excluindo stripe_product_id e stripe_price_id)
    SELECT code, name, max_users, priority_suggestions 
    INTO v_plan 
    FROM public.plans 
    WHERE id = v_sub.plan_id;
    
    -- Contar usuários ativos
    SELECT COUNT(*) INTO v_user_count 
    FROM public.user_company_access 
    WHERE empresa_id = p_empresa_id 
    AND status = 'active';
    
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

    -- Retorno seguro sem campos sensíveis ou segredos
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

-- 3. Grants da função: Revogar de PUBLIC/anon, Conceder a authenticated
REVOKE ALL ON FUNCTION public.get_company_subscription_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_subscription_context(uuid) TO authenticated;

-- 4. Preservar bloqueios diretos (Auditoria de segurança extra)
REVOKE SELECT ON public.plans FROM authenticated, anon;
GRANT SELECT (
    code, name, description, amount_cents, currency, billing_interval,
    trial_days, grace_days, max_users, all_features_enabled,
    priority_suggestions, requires_payment_method, is_public, is_active, sort_order
) ON public.plans TO authenticated, anon;

REVOKE ALL ON public.subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.payment_events FROM PUBLIC, anon, authenticated;

COMMIT;