-- CP-04 PROTOTYPE / REVIEW ONLY. DO NOT APPLY TO ANY DATABASE.
-- Prerequisites: separately approved additive series_id/index/total migration;
-- validated company membership/RLS and controlled test database.
-- Atomicity: one PostgreSQL function invocation = one transaction.
-- Restricted prototype: amount and monthly due_date ONLY.
CREATE OR REPLACE FUNCTION public.preview_edit_payables_series_cp04(
  p_empresa_id uuid,
  p_selected_id uuid,
  p_scope text,
  p_new_amount numeric,
  p_anchor_due_date date,
  p_expected_ids uuid[]
)
RETURNS TABLE(payable_id uuid, installment_index integer, previous_amount numeric,
              next_amount numeric, previous_due_date date, next_due_date date)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_selected public.payables%ROWTYPE;
  v_series_count integer;
  v_series_total integer;
  v_selected_ids uuid[];
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_scope NOT IN ('single','future','all') THEN RAISE EXCEPTION 'Invalid scope'; END IF;
  IF p_new_amount IS NULL OR p_new_amount <= 0 OR
     p_new_amount <> round(p_new_amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_anchor_due_date IS NULL THEN RAISE EXCEPTION 'Invalid due date'; END IF;

  -- Prototype assumes columns series_id/index/total exist (NOT YET MIGRATED).
  -- Lock the entire series in a future write RPC, ordered by id, before validations.
  SELECT * INTO v_selected FROM public.payables
   WHERE id = p_selected_id AND empresa_id = p_empresa_id
     AND user_id = (SELECT auth.uid());
  IF NOT FOUND OR v_selected.series_id IS NULL THEN
    RAISE EXCEPTION 'Selected installment has no verified series';
  END IF;
  IF v_selected.status NOT IN ('pendente','atrasado') OR
     v_selected.paid_amount <> 0 OR v_selected.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Selected installment is not fully open';
  END IF;

  SELECT count(*), max(series_total) INTO v_series_count,v_series_total
    FROM public.payables
    WHERE series_id = v_selected.series_id AND empresa_id = p_empresa_id
      AND user_id = (SELECT auth.uid());
  IF v_series_count <> v_selected.series_total OR
     v_series_total <> v_selected.series_total OR
     (SELECT count(distinct series_index) FROM public.payables
       WHERE series_id=v_selected.series_id AND empresa_id=p_empresa_id
         AND user_id=(SELECT auth.uid())) <> v_series_count
  THEN RAISE EXCEPTION 'Incomplete or ambiguous series'; END IF;

  SELECT array_agg(p.id ORDER BY p.series_index) INTO v_selected_ids
    FROM public.payables p
    WHERE p.series_id = v_selected.series_id AND p.empresa_id = p_empresa_id
      AND p.user_id = (SELECT auth.uid())
      AND p.status IN ('pendente','atrasado')
      AND p.paid_amount = 0 AND p.paid_at IS NULL
      AND (p_scope = 'all' OR p.series_index >= v_selected.series_index)
      AND (p_scope <> 'single' OR p.id = p_selected_id);
  IF v_selected_ids IS NULL OR v_selected_ids IS DISTINCT FROM p_expected_ids THEN
    RAISE EXCEPTION 'Preview stale or scope mismatch'; END IF;

  RETURN QUERY
  SELECT p.id,p.series_index,p.amount,p_new_amount,p.due_date,
         (date_trunc('month',p_anchor_due_date)::date +
           make_interval(months => p.series_index-v_selected.series_index))::date
         + (least(extract(day from p_anchor_due_date)::integer,
           extract(day from (
             date_trunc('month',p_anchor_due_date)::date +
             make_interval(months => p.series_index-v_selected.series_index+1)
             - interval '1 day'))::integer)-1)
    FROM public.payables p
    WHERE p.id = ANY(v_selected_ids)
    ORDER BY p.series_index;
END;
$$;
-- This prototype is READ-ONLY, and its date expression requires integration tests.
-- DO NOT grant EXECUTE / deploy until reviewed; SQL file is an inert draft.
-- Write RPC: lock all series rows with FOR UPDATE, recompute preview and snapshot,
-- verify company membership and RLS, update rows, assert row count, return results.
-- Any raised exception must abort the entire transaction.
