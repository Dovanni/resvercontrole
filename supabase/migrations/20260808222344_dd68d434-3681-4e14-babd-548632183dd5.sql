BEGIN;

-- 1. Remover overloads legados vulneráveis
DROP FUNCTION IF EXISTS public.get_company_subscription_context(uuid);
DROP FUNCTION IF EXISTS public.get_company_subscription_context(uuid, uuid);

-- 2. Criar RPC administrativa com nome inequívoco e contrato estrito
CREATE OR REPLACE FUNCTION public.get_company_subscription_context_admin(
    p_empresa_id uuid,
    p_verified_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_has_access boolean;
    v_sub record;
    v_plan record;
    v_user_count integer;
    v_access_mode text;
    v_days_remaining integer;
BEGIN
    -- Validação obrigatória de parâmetros
    IF p_empresa_id IS NULL OR p_verified_user_id IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters: p_empresa_id and p_verified_user_id are mandatory.';
    END IF;

    -- Validar membership active de p_verified_user_id em p_empresa_id
    -- Usando relações totalmente qualificadas para segurança adicional
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = p_verified_user_id
          AND empresa_id = p_empresa_id
          AND status = 'active'
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        -- Falha fechada: se não for membro, retorna NULL ou erro silencioso
        -- Retornamos NULL para indicar "Sem acesso/Não encontrado"
        RETURN NULL;
    END IF;

    -- Buscar assinatura ativa (Isolation por empresa_id garantido pelo WHERE)
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
    LIMIT 1;

    -- Caso não tenha assinatura, retorna perfil básico 'none'
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

    -- Buscar detalhes do plano
    SELECT code, name, max_users, priority_suggestions
    INTO v_plan
    FROM public.plans
    WHERE id = v_sub.plan_id;

    -- Contagem de usuários ativos para validação de limites
    SELECT COUNT(*) INTO v_user_count
    FROM public.user_company_access
    WHERE empresa_id = p_empresa_id
      AND status = 'active';

    -- Lógica de modo de acesso e dias restantes (copiada da lógica comercial aprovada)
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

    -- Retorno sanitizado (NÃO inclui IDs de produto/preço Stripe ou eventos de pagamento)
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

-- 3. ACLs Rígidas
ALTER FUNCTION public.get_company_subscription_context_admin(uuid, uuid) OWNER TO postgres;

-- Bloqueio total por padrão
REVOKE ALL ON FUNCTION public.get_company_subscription_context_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Permissão exclusiva para service_role
GRANT EXECUTE ON FUNCTION public.get_company_subscription_context_admin(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;