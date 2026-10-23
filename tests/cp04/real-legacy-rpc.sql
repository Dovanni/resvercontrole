\set ON_ERROR_STOP on
-- Runs both REAL proposed CP-04 functions in an ephemeral PostgreSQL 17 service.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE
 ids uuid[] := ARRAY[
 '00000000-0000-4000-8000-000000000011'::uuid,
 '00000000-0000-4000-8000-000000000012'::uuid,
 '00000000-0000-4000-8000-000000000013'::uuid
 ];
 snapshot jsonb;
 assigned integer;
 updated integer;
 sid uuid;
BEGIN
 SELECT jsonb_agg(jsonb_build_object(
 'id',p.id,'description',p.description,'amount',p.amount,
 'due_date',p.due_date,'status',p.status,'paid_amount',p.paid_amount,
 'paid_at',p.paid_at) ORDER BY array_position(ids,p.id))
 INTO snapshot FROM public.payables p WHERE p.id=ANY(ids);
 SELECT count(*) INTO assigned FROM public.reconcile_legacy_payables_cp04(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,ids,snapshot);
 IF assigned<>3 THEN RAISE EXCEPTION 'Legacy assignment count mismatch: %',assigned; END IF;
 SELECT series_id INTO sid FROM public.payables WHERE id=ids[1];
 IF sid IS NULL OR (SELECT count(DISTINCT series_id) FROM public.payables WHERE id=ANY(ids))<>1
 OR (SELECT array_agg(series_index ORDER BY series_index) FROM public.payables WHERE id=ANY(ids))<>ARRAY[1,2,3]
 THEN RAISE EXCEPTION 'Legacy series identity mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.payables WHERE id=ANY(ids) AND amount<>100.24)
 THEN RAISE EXCEPTION 'Legacy reconciliation changed financial amounts'; END IF;
 -- Use exactly the snapshot shape expected by the real edit RPC.
 SELECT jsonb_agg(jsonb_build_object(
 'id',p.id,'amount',p.amount,'due_date',p.due_date,
 'status',p.status,'paid_amount',p.paid_amount,'paid_at',p.paid_at
 ) ORDER BY p.series_index) INTO snapshot
 FROM public.payables p WHERE p.series_id=sid;
 SELECT count(*) INTO updated FROM public.edit_payables_series_cp04(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,ids[1],'all',150.50,
 '2026-04-10'::date,snapshot);
 IF updated<>2 THEN RAISE EXCEPTION 'Expected 2 pending installments, got %',updated; END IF;
 IF (SELECT amount FROM public.payables WHERE id=ids[2])<>100.24
 OR (SELECT paid_amount FROM public.payables WHERE id=ids[2])<>100.24
 OR (SELECT amount FROM public.payables WHERE id=ids[1])<>150.50
 OR (SELECT amount FROM public.payables WHERE id=ids[3])<>150.50
 THEN RAISE EXCEPTION 'Settled row modified or pending rows unchanged'; END IF;
 BEGIN
  PERFORM public.edit_payables_series_cp04(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,ids[1],'all',200,
  '2026-04-10'::date,snapshot);
  RAISE EXCEPTION 'Stale snapshot incorrectly accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Stale snapshot incorrectly accepted' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'CP04 REAL LEGACY RECONCILIATION + REAL EDIT RPC PASSED';
END;
$test$;
ROLLBACK;
