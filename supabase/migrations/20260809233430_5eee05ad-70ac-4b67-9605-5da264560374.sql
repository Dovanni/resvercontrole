
-- REFINED COMMERCIAL OFFER MIGRATION (VEJAMAIS ESSENCIAL/EMPRESARIAL)

DO $$ 
BEGIN 
    RAISE NOTICE 'Starting migration 20260809232400...'; 
END $$;

-- 1. Catalog Upsert (Using established amount_cents schema)
INSERT INTO public.plans (
    code, name, description, amount_cents, currency, trial_days, max_users, 
    all_features_enabled, is_active, is_public, requires_payment_method
)
VALUES 
    ('essencial', 'Essencial', 'Avaliação gratuita de 30 dias com todos os recursos.', 0, 'BRL', 30, 5, true, true, true, false),
    ('empresarial', 'Empresarial', 'Continuidade completa com todos os recursos.', 3590, 'BRL', 0, 5, true, true, true, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    amount_cents = EXCLUDED.amount_cents,
    trial_days = EXCLUDED.trial_days,
    max_users = EXCLUDED.max_users,
    is_active = EXCLUDED.is_active,
    is_public = EXCLUDED.is_public,
    requires_payment_method = EXCLUDED.requires_payment_method;

-- 2. Subscription table uniqueness check
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_empresa_id_key') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_empresa_id_key UNIQUE (empresa_id);
    END IF;
END $$;

-- 3. Consolidate can_company_invite_member RPC
-- This is the canon authority for user limit enforcement.
CREATE OR REPLACE FUNCTION public.can_company_invite_member(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_users INTEGER;
    v_active_members INTEGER;
    v_pending_invites INTEGER;
    v_total_reserved INTEGER;
BEGIN
    -- Get plan limit from the current active subscription
    SELECT p.max_users INTO v_max_users
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.empresa_id = p_empresa_id
      AND s.status NOT IN ('canceled', 'incomplete_expired')
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- Default fallback
    IF NOT FOUND THEN v_max_users := 5; END IF;

    -- Count active memberships
    SELECT count(*) INTO v_active_members
    FROM public.user_company_access
    WHERE empresa_id = p_empresa_id AND status = 'active';

    -- Count pending invitations (if table exists, else 0)
    BEGIN
        EXECUTE 'SELECT count(*) FROM public.company_invitations WHERE empresa_id = $1 AND status = ''pending'' AND expires_at > now()'
        INTO v_pending_invites
        USING p_empresa_id;
    EXCEPTION WHEN OTHERS THEN
        v_pending_invites := 0;
    END;

    v_total_reserved := v_active_members + v_pending_invites;

    IF v_total_reserved >= v_max_users THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current', v_total_reserved,
            'limit', v_max_users,
            'message', 'Limite de ' || v_max_users || ' usuários atingido.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true, 
        'current', v_total_reserved, 
        'limit', v_max_users, 
        'message', 'Permitido.'
    );
END;
$$;

-- 4. Grants verification
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.user_company_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_company_invite_member(UUID) TO authenticated;
