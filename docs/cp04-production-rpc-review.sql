-- CP-04 / REVIEW ONLY / NOT DEPLOYED
-- Requires approved series_id/index/total migration and validated company authorization.
-- This is the proposed production RPC; keep disabled until Supabase Auth/RLS and concurrency tests pass.
BEGIN;
CREATE OR REPLACE FUNCTION public.edit_payables_series_cp04(
 p_empresa_id uuid,
 p_payable_id uuid,
 p_scope text,
 p_new_amount numeric,
 p_anchor_due_date date,
 p_expected_snapshot jsonb
) RETURNS TABLE(id uuid, old_amount numeric, new_amount numeric, old_due_date date, new_due_date date)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
 v_user uuid := (SELECT auth.uid());
 v_selected public.payables%ROWTYPE;
 v_series_total integer;
 v_count integer;
 v_target_count integer;
 v_snapshot jsonb;
BEGIN
 IF v_user IS NULL OR p_empresa_id IS NULL OR p_payable_id IS NULL THEN
  RAISE EXCEPTION 'Unauthorized or missing scope' USING ERRCODE='42501';
 END IF;
 IF p_scope IS NULL OR p_scope NOT IN ('single','future','all') THEN
  RAISE EXCEPTION 'Invalid scope';
 END IF;
 IF p_new_amount IS NULL OR p_new_amount <= 0 OR p_new_amount <> round(p_new_amount,2)
    OR p_anchor_due_date IS NULL THEN RAISE EXCEPTION 'Invalid financial values'; END IF;
 IF p_expected_snapshot IS NULL OR jsonb_typeof(p_expected_snapshot)<>'array' THEN
  RAISE EXCEPTION 'Confirmation snapshot required';
 END IF;
 -- Require a currently active company membership and financial role.
 -- SECURITY INVOKER: user_company_access SELECT RLS limits rows to auth.uid().
 -- Lock membership to prevent concurrent revocation during this transaction.
 PERFORM m.id FROM public.user_company_access m
  JOIN public.empresas e ON e.id=m.empresa_id
  WHERE m.user_id=v_user AND m.empresa_id=p_empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
  FOR SHARE OF m,e;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Company membership or financial permission denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_selected FROM public.payables
  WHERE public.payables.id=p_payable_id
    AND empresa_id=p_empresa_id AND user_id=v_user;
 IF NOT FOUND OR v_selected.series_id IS NULL THEN
  RAISE EXCEPTION 'Unknown or legacy series';
 END IF;
 -- Lock every row of the series, including settled rows, in stable ID order.
 PERFORM p.id FROM public.payables p
  WHERE p.empresa_id=p_empresa_id AND p.series_id=v_selected.series_id
  ORDER BY p.id FOR UPDATE;
 -- Re-read selected row after locks: a concurrent transaction may have changed it.
 SELECT * INTO v_selected FROM public.payables p
  WHERE p.id=p_payable_id AND p.empresa_id=p_empresa_id AND p.user_id=v_user;
 IF NOT FOUND OR v_selected.series_id IS NULL OR
    v_selected.status NOT IN ('pendente','atrasado') OR
    coalesce(v_selected.paid_amount,0)<>0 OR v_selected.paid_at IS NOT NULL THEN
  RAISE EXCEPTION 'Selected installment not fully open';
 END IF;
 SELECT count(*), max(p.series_total) INTO v_count,v_series_total
  FROM public.payables p WHERE p.empresa_id=p_empresa_id AND p.series_id=v_selected.series_id
    AND p.user_id=v_user;
 IF v_count<>v_selected.series_total OR v_series_total<>v_selected.series_total OR
    EXISTS(SELECT 1 FROM public.payables p
      WHERE p.empresa_id=p_empresa_id AND p.series_id=v_selected.series_id
        AND (p.user_id<>v_user OR p.series_total<>v_selected.series_total)) OR
    (SELECT count(distinct p.series_index) FROM public.payables p
      WHERE p.empresa_id=p_empresa_id AND p.series_id=v_selected.series_id
        AND p.user_id=v_user)<>v_count THEN
   RAISE EXCEPTION 'Series incomplete or inconsistent';
 END IF;
 -- Snapshot is a canonical array of {id,amount,due_date,status,paid_amount,paid_at}.
 -- Validate ALL series rows, not only targets, so changed payments invalidate confirmation.
 SELECT jsonb_agg(jsonb_build_object(
  'id',p.id,'amount',p.amount,'due_date',p.due_date,
  'status',p.status,'paid_amount',p.paid_amount,'paid_at',p.paid_at
 ) ORDER BY p.series_index) INTO v_snapshot
 FROM public.payables p WHERE p.empresa_id=p_empresa_id
   AND p.series_id=v_selected.series_id AND p.user_id=v_user;
 IF v_snapshot IS DISTINCT FROM p_expected_snapshot THEN
  RAISE EXCEPTION 'Confirmation expired; refresh preview';
 END IF;
 SELECT count(*) INTO v_target_count FROM public.payables p
 WHERE p.empresa_id=p_empresa_id AND p.user_id=v_user AND p.series_id=v_selected.series_id
  AND p.status IN ('pendente','atrasado') AND coalesce(p.paid_amount,0)=0
  AND p.paid_at IS NULL
  AND (p_scope='all' OR p.series_index>=v_selected.series_index)
  AND (p_scope<>'single' OR p.id=p_payable_id);
 IF v_target_count<1 THEN RAISE EXCEPTION 'No eligible installments'; END IF;
 RETURN QUERY
 WITH targets AS (
  SELECT p.id,p.amount,p.due_date,p.series_index,
   (date_trunc('month',p_anchor_due_date)::date
     + make_interval(months => p.series_index-v_selected.series_index))::date AS month_start
  FROM public.payables p
  WHERE p.empresa_id=p_empresa_id AND p.user_id=v_user
   AND p.series_id=v_selected.series_id
   AND p.status IN ('pendente','atrasado') AND coalesce(p.paid_amount,0)=0
   AND p.paid_at IS NULL
   AND (p_scope='all' OR p.series_index>=v_selected.series_index)
   AND (p_scope<>'single' OR p.id=p_payable_id)
 ), scheduled AS (
  SELECT t.*,
   (t.month_start + (least(
      extract(day from p_anchor_due_date)::integer,
      extract(day from (t.month_start + interval '1 month - 1 day'))::integer
    )-1))::date AS next_due
  FROM targets t
 ), updated AS (
  UPDATE public.payables p SET amount=p_new_amount,due_date=s.next_due
   FROM scheduled s WHERE p.id=s.id
   RETURNING p.id
 )
 SELECT s.id,s.amount,p_new_amount,s.due_date,s.next_due
 FROM scheduled s JOIN updated u ON u.id=s.id ORDER BY s.series_index;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 IF v_count <> v_target_count THEN
  RAISE EXCEPTION 'Partial update; rolling back transaction';
 END IF;
 -- Gate: prove real Supabase Auth/JWT, RLS and membership revocation in isolated lab before any GRANT.
END;
$function$;
REVOKE ALL ON FUNCTION public.edit_payables_series_cp04(uuid,uuid,text,numeric,date,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edit_payables_series_cp04(uuid,uuid,text,numeric,date,jsonb) FROM anon;
-- Deliberately do NOT grant authenticated EXECUTE until security gates pass.
COMMIT;
