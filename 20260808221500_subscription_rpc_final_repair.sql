-- PROTOCOLO: VEJAMAIS_BILLING_PHASE_1_RUNTIME_CONTRACT_FAILURE_REPRODUCTION_AND_MINIMAL_CORRECTION
-- DESCRIÇÃO: Reparo final e transacional da RPC de contexto de assinatura.
-- MOTIVO: Garantir que a RPC retorne dados válidos sob sessão authenticated sem grants diretos.

BEGIN;

-- 1. Recriar a função com o owner postgres e SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_company_subscription_context(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        RAISE DEBUG 'get_company_subscription_context: v_user_id is NULL';
        RETURN NULL;
    END IF;

    -- Validar membership active da empresa solicitada (Isolamento de Tenant)
    -- Importante: SECURITY DEFINER permite ler user_company_access sem policy
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = v_user_id
          AND empresa_id = p_empresa_id
          AND status = 'active'
    ) INTO v_has_access;

    -- Falhar de forma segura em acesso cruzado ou ausência de vínculo
    IF NOT v_has_access THEN
        RAISE DEBUG 'get_company_subscription_context: No access for user % to company %', v_user_id, p_empresa_id;
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
            'plan_name', 'Nenhum',
            'status', 'none',
            'access_mode', 'restricted',
            'days_remaining', 0,
            'current_user_count', 0,
            'max_users', 0,
            'can_invite_member', false,
            'priority_suggestions', false
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
        v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.trial_ends_at - now()))::integer);
        v_access_mode := 'full';
    ELSIF v_sub.status = 'active' THEN
        v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_ends_at - now()))::integer);
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

-- 2. Garantir que o owner seja postgres (Privilegiado)
ALTER FUNCTION public.get_company_subscription_context(uuid) OWNER TO postgres;

-- 3. Revogar acesso público e conceder apenas a authenticated/service_role
REVOKE ALL ON FUNCTION public.get_company_subscription_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_company_subscription_context(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_company_subscription_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_subscription_context(uuid) TO service_role;

-- 4. Notificar PostgREST para recarregar o cache
NOTIFY pgrst, 'reload schema';

COMMIT;
