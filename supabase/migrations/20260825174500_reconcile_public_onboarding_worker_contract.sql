-- VCRL-G2.33 — Public Company Onboarding Worker-Native Contract Reconciliation
-- Repository-only migration candidate. Do not apply outside the authorized staging gate.

BEGIN;

-- 1. Reconcile profiles with the contract consumed by onboarding/runtime.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_empresa_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_empresa_id_fkey
      FOREIGN KEY (empresa_id)
      REFERENCES public.empresas(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_empresa_id
  ON public.profiles(empresa_id);

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles(lower(email));

-- 2. Restore the canonical reservation RPC. A later historical migration drifted
-- this function into premature company creation, which breaks public pre-auth signup.
DROP FUNCTION IF EXISTS public.create_pending_onboarding(text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_pending_onboarding(text, text, text, text, text, text, text, integer);

CREATE FUNCTION public.create_pending_onboarding(
  p_nome_admin text,
  p_nome_empresa text,
  p_cnpj_formatado text,
  p_cnpj_limpo text,
  p_email_hash text,
  p_terms_version text,
  p_privacy_version text,
  p_expires_in_hours integer DEFAULT 24
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_existing pending_onboardings%ROWTYPE;
  v_cnpj text := upper(regexp_replace(coalesce(p_cnpj_limpo, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF nullif(trim(p_nome_admin), '') IS NULL
     OR nullif(trim(p_nome_empresa), '') IS NULL
     OR nullif(trim(p_email_hash), '') IS NULL
     OR nullif(v_cnpj, '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_ONBOARDING_INPUT';
  END IF;

  IF p_expires_in_hours < 1 OR p_expires_in_hours > 168 THEN
    RAISE EXCEPTION 'INVALID_ONBOARDING_EXPIRY';
  END IF;

  -- Serialize requests for the same company document.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_cnpj, 0));

  IF EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE upper(regexp_replace(coalesce(e.documento, ''), '[^A-Za-z0-9]', '', 'g')) = v_cnpj
  ) THEN
    RAISE EXCEPTION 'COMPANY_ALREADY_EXISTS';
  END IF;

  -- Expire stale reservations for the same identity/document before reuse checks.
  UPDATE public.pending_onboardings
     SET status = 'expired', updated_at = now()
   WHERE status = 'pending'
     AND expires_at <= now()
     AND (email_hash = p_email_hash OR cnpj_limpo = v_cnpj);

  -- Idempotent retry for the same identity + document.
  SELECT *
    INTO v_existing
    FROM public.pending_onboardings
   WHERE status = 'pending'
     AND expires_at > now()
     AND email_hash = p_email_hash
     AND cnpj_limpo = v_cnpj
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.pending_onboardings
       SET nome_admin = trim(p_nome_admin),
           nome_empresa = trim(p_nome_empresa),
           cnpj_formatado = nullif(trim(p_cnpj_formatado), ''),
           consent_version_terms = p_terms_version,
           consent_version_privacy = p_privacy_version,
           consented_at = now(),
           updated_at = now()
     WHERE id = v_existing.id;

    RETURN v_existing.id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pending_onboardings p
    WHERE p.status = 'pending'
      AND p.expires_at > now()
      AND p.cnpj_limpo = v_cnpj
      AND p.email_hash <> p_email_hash
  ) THEN
    RAISE EXCEPTION 'COMPANY_ONBOARDING_ALREADY_PENDING';
  END IF;

  INSERT INTO public.pending_onboardings (
    nome_admin,
    nome_empresa,
    cnpj_formatado,
    cnpj_limpo,
    email_hash,
    consent_version_terms,
    consent_version_privacy,
    expires_at
  ) VALUES (
    trim(p_nome_admin),
    trim(p_nome_empresa),
    nullif(trim(p_cnpj_formatado), ''),
    v_cnpj,
    p_email_hash,
    p_terms_version,
    p_privacy_version,
    now() + make_interval(hours => p_expires_in_hours)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_onboarding(text, text, text, text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_onboarding(text, text, text, text, text, text, text, integer)
  TO service_role;

-- 3. Harden linking of the invited Auth identity to exactly one live reservation.
CREATE OR REPLACE FUNCTION public.link_auth_user_to_onboarding(
  p_onboarding_id uuid,
  p_auth_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_auth_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_auth_user_id
  ) THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pending_onboardings p
    WHERE p.auth_user_id = p_auth_user_id
      AND p.status = 'pending'
      AND p.expires_at > now()
      AND p.id <> p_onboarding_id
  ) THEN
    RAISE EXCEPTION 'AUTH_USER_ALREADY_HAS_PENDING_ONBOARDING';
  END IF;

  UPDATE public.pending_onboardings
     SET auth_user_id = p_auth_user_id,
         updated_at = now()
   WHERE id = p_onboarding_id
     AND status = 'pending'
     AND expires_at > now()
     AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'PENDING_ONBOARDING_NOT_LINKABLE';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.link_auth_user_to_onboarding(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_auth_user_to_onboarding(uuid, uuid)
  TO service_role;

-- 4. Reconcile finalization with the actual canonical table columns.
CREATE OR REPLACE FUNCTION public.finalize_user_onboarding(p_auth_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_onboarding public.pending_onboardings%ROWTYPE;
  v_empresa_id uuid;
  v_existing_owner uuid;
  v_email text;
  v_onboarding_count integer;
BEGIN
  SELECT lower(trim(u.email))
    INTO v_email
    FROM auth.users u
   WHERE u.id = p_auth_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
  END IF;

  SELECT count(*)
    INTO v_onboarding_count
    FROM public.pending_onboardings p
   WHERE p.auth_user_id = p_auth_user_id
     AND p.status = 'pending'
     AND p.expires_at > now();

  IF v_onboarding_count = 0 THEN
    SELECT uca.empresa_id
      INTO v_empresa_id
      FROM public.user_company_access uca
     WHERE uca.user_id = p_auth_user_id
       AND uca.status = 'active'
     ORDER BY uca.is_primary DESC NULLS LAST, uca.created_at ASC
     LIMIT 1;

    IF v_empresa_id IS NOT NULL OR EXISTS (
      SELECT 1
      FROM public.pending_onboardings p
      WHERE p.auth_user_id = p_auth_user_id
        AND p.status = 'activated'
    ) THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_finalized', true,
        'empresa_id', v_empresa_id
      );
    END IF;

    RAISE EXCEPTION 'NO_VALID_PENDING_ONBOARDING';
  ELSIF v_onboarding_count > 1 THEN
    RAISE EXCEPTION 'MULTIPLE_PENDING_ONBOARDINGS';
  END IF;

  SELECT *
    INTO v_onboarding
    FROM public.pending_onboardings p
   WHERE p.auth_user_id = p_auth_user_id
     AND p.status = 'pending'
     AND p.expires_at > now()
   FOR UPDATE;

  PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(v_onboarding.cnpj_limpo, v_onboarding.id::text), 0));

  SELECT e.id, e.owner_id
    INTO v_empresa_id, v_existing_owner
    FROM public.empresas e
   WHERE upper(regexp_replace(coalesce(e.documento, ''), '[^A-Za-z0-9]', '', 'g')) = v_onboarding.cnpj_limpo
   ORDER BY e.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF v_empresa_id IS NOT NULL AND v_existing_owner <> p_auth_user_id THEN
    RAISE EXCEPTION 'COMPANY_ALREADY_EXISTS';
  END IF;

  IF v_empresa_id IS NULL THEN
    INSERT INTO public.empresas (
      nome,
      documento,
      owner_id,
      status,
      razao_social,
      configuracoes
    ) VALUES (
      v_onboarding.nome_empresa,
      v_onboarding.cnpj_limpo,
      p_auth_user_id,
      'active',
      v_onboarding.nome_empresa,
      jsonb_build_object('onboarding_completed_at', now())
    )
    RETURNING id INTO v_empresa_id;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    business_name,
    email,
    empresa_id,
    updated_at
  ) VALUES (
    p_auth_user_id,
    v_onboarding.nome_admin,
    v_onboarding.nome_empresa,
    v_email,
    v_empresa_id,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    business_name = EXCLUDED.business_name,
    email = EXCLUDED.email,
    empresa_id = EXCLUDED.empresa_id,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_auth_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_company_access (
    user_id,
    empresa_id,
    role,
    status,
    is_primary
  ) VALUES (
    p_auth_user_id,
    v_empresa_id,
    'admin',
    'active',
    true
  )
  ON CONFLICT (user_id, empresa_id) DO UPDATE SET
    role = 'admin',
    status = 'active',
    is_primary = true;

  PERFORM public.ensure_empresa_defaults(v_empresa_id, p_auth_user_id);

  UPDATE public.pending_onboardings
     SET status = 'activated',
         updated_at = now()
   WHERE id = v_onboarding.id;

  RETURN jsonb_build_object(
    'success', true,
    'already_finalized', false,
    'empresa_id', v_empresa_id,
    'onboarding_id', v_onboarding.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_user_onboarding(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_user_onboarding(uuid)
  TO authenticated, service_role;

-- 5. Preserve the authenticated idempotent reconciliation entry point.
CREATE OR REPLACE FUNCTION public.reconcile_and_finalize_onboarding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT uca.empresa_id
    INTO v_empresa_id
    FROM public.user_company_access uca
   WHERE uca.user_id = v_user_id
     AND uca.status = 'active'
   ORDER BY uca.is_primary DESC NULLS LAST, uca.created_at ASC
   LIMIT 1;

  IF v_empresa_id IS NULL THEN
    v_result := public.finalize_user_onboarding(v_user_id);
    IF NOT coalesce((v_result ->> 'success')::boolean, false) THEN
      RETURN v_result;
    END IF;
    v_empresa_id := nullif(v_result ->> 'empresa_id', '')::uuid;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_WITHOUT_ACTIVE_COMPANY';
  END IF;

  PERFORM public.ensure_empresa_defaults(v_empresa_id, v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'empresa_id', v_empresa_id,
    'already_finalized', coalesce((v_result ->> 'already_finalized')::boolean, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_and_finalize_onboarding()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_and_finalize_onboarding()
  TO authenticated, service_role;

COMMIT;
