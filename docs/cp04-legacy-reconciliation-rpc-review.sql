-- CP-04 / LAB REVIEW ONLY / NEVER RUN ON PRODUCTION WITHOUT APPROVAL
-- Assigns a persistent series ID to an explicitly reviewed complete legacy series.
-- Does not alter amount, due_date, status, description, or payment details.
-- Requires previously approved nullable series_id/index/total schema.
-- SECURITY INVOKER + RLS; authenticated membership must be checked independently.
BEGIN;
CREATE OR REPLACE FUNCTION public.reconcile_legacy_payables_cp04(
  p_empresa_id uuid,
  p_ordered_ids uuid[],
  p_expected_snapshot jsonb
) RETURNS TABLE(payable_id uuid, assigned_series_id uuid, assigned_index integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_total integer := coalesce(array_length(p_ordered_ids,1),0);
  v_series uuid := gen_random_uuid();
  v_rows integer;
  v_snapshot jsonb;
  v_expected jsonb;
BEGIN
  IF v_user IS NULL OR p_empresa_id IS NULL OR v_total < 2 OR v_total > 120
     OR p_expected_snapshot IS NULL OR jsonb_typeof(p_expected_snapshot) <> 'array'
  THEN RAISE EXCEPTION 'Invalid legacy reconciliation request'; END IF;

  IF (SELECT count(DISTINCT x) FROM unnest(p_ordered_ids) x) <> v_total
  THEN RAISE EXCEPTION 'Duplicate installment IDs'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access m
    JOIN public.empresas e ON e.id = m.empresa_id
    WHERE m.user_id = v_user AND m.empresa_id = p_empresa_id
      AND m.status = 'active' AND m.role::text IN ('admin','financeiro')
      AND e.status = 'active'
  ) THEN RAISE EXCEPTION 'Company authorization denied'; END IF;

  -- Lock the reviewed IDs deterministically, including paid/cancelled installments.
  PERFORM 1 FROM public.payables p
    WHERE p.id = ANY(p_ordered_ids) AND p.empresa_id = p_empresa_id AND p.user_id = v_user
    ORDER BY p.id FOR UPDATE;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_total THEN RAISE EXCEPTION 'Missing or inaccessible installments'; END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) WITH ORDINALITY input(id,idx)
    JOIN public.payables p ON p.id=input.id
    WHERE p.series_id IS NOT NULL OR p.series_index IS NOT NULL OR p.series_total IS NOT NULL
      OR (regexp_match(p.description, $re$\(([0-9]+)/([0-9]+)\)\s*$re$)) IS NULL
      OR (regexp_match(p.description, $re$\(([0-9]+)/([0-9]+)\)\s*$re$))[1]::integer <> input.idx
      OR (regexp_match(p.description, $re$\(([0-9]+)/([0-9]+)\)\s*$re$))[2]::integer <> v_total
  ) THEN RAISE EXCEPTION 'Incomplete, identified, or incorrectly ordered series'; END IF;

  -- Snapshot prevents stale approvals. Exact server-side comparison, after row locks.
  SELECT jsonb_agg(jsonb_build_object(
      'id',p.id,'description',p.description,'amount',p.amount,
      'due_date',p.due_date,'status',p.status,'paid_amount',p.paid_amount,
      'paid_at',p.paid_at
    ) ORDER BY input.idx)
  INTO v_snapshot
  FROM unnest(p_ordered_ids) WITH ORDINALITY input(id,idx)
  JOIN public.payables p ON p.id=input.id;

  IF v_snapshot IS DISTINCT FROM p_expected_snapshot
  THEN RAISE EXCEPTION 'Stale or incomplete reconciliation snapshot'; END IF;

  -- Never infer identity solely from the suffix: block duplicate labels in tenant.
  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) input(id)
    JOIN public.payables selected ON selected.id=input.id
    JOIN public.payables other ON other.empresa_id=p_empresa_id
      AND other.user_id=v_user AND other.description=selected.description
      AND other.id<>selected.id AND other.series_id IS NULL
  ) THEN RAISE EXCEPTION 'Ambiguous legacy descriptions: manual review required'; END IF;

  RETURN QUERY
  WITH changed AS (
    UPDATE public.payables p
      SET series_id=v_series,series_index=input.idx::integer,series_total=v_total
    FROM unnest(p_ordered_ids) WITH ORDINALITY input(id,idx)
    WHERE p.id=input.id AND p.empresa_id=p_empresa_id AND p.user_id=v_user
      AND p.series_id IS NULL
    RETURNING p.id,p.series_id,p.series_index
  )
  SELECT changed.id,changed.series_id,changed.series_index FROM changed;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> v_total THEN RAISE EXCEPTION 'Incomplete reconciliation: rollback'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.reconcile_legacy_payables_cp04(uuid,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
-- No GRANT EXECUTE until reviewed lab integration and explicit release gate.
COMMIT;
