\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE
 sid uuid := '99999999-9999-4999-8999-999999999999';
 company uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 selected uuid := '00000000-0000-4000-8000-000000000021';
 snapshot jsonb;
 updated integer;
BEGIN
 SELECT jsonb_agg(jsonb_build_object(
  'id',p.id,'amount',p.amount,'due_date',p.due_date,'status',p.status,
  'paid_amount',p.paid_amount,'paid_at',p.paid_at,'recurrence',p.recurrence) ORDER BY p.series_index)
 INTO snapshot FROM public.payables p WHERE p.series_id=sid;
 SELECT count(*) INTO updated FROM public.edit_payables_series_cp04(
  company,selected,'all',170.25,'2026-12-20',snapshot);
 IF updated<>4 THEN RAISE EXCEPTION 'Legacy update count %',updated; END IF;
 IF EXISTS (SELECT 1 FROM public.payables p WHERE p.series_id=sid AND
   (p.amount<>170.25 OR p.recurrence<>'nenhuma')) THEN
  RAISE EXCEPTION 'Legacy amount or recurrence mismatch';
 END IF;
 IF (SELECT due_date FROM public.payables WHERE id=selected)<>'2026-12-20'
 OR (SELECT due_date FROM public.payables WHERE series_id=sid AND series_index=2)<>'2027-01-10'
 OR (SELECT due_date FROM public.payables WHERE series_id=sid AND series_index=3)<>'2027-02-10'
 OR (SELECT due_date FROM public.payables WHERE series_id=sid AND series_index=4)<>'2027-03-10'
 THEN RAISE EXCEPTION 'Historical due-date offsets not preserved'; END IF;
 BEGIN
  PERFORM public.edit_payables_series_cp04(company,selected,'all',180,'2026-12-20',snapshot);
  RAISE EXCEPTION 'Stale snapshot accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Stale snapshot accepted' THEN RAISE; END IF;
 END;
 -- Capture a FRESH snapshot after the amount/date edit, then change ONLY recurrence.
 -- This proves the new field itself invalidates the approved confirmation.
 SELECT jsonb_agg(jsonb_build_object(
  'id',p.id,'amount',p.amount,'due_date',p.due_date,'status',p.status,
  'paid_amount',p.paid_amount,'paid_at',p.paid_at,'recurrence',p.recurrence
 ) ORDER BY p.series_index)
 INTO snapshot FROM public.payables p WHERE p.series_id=sid;
 UPDATE public.payables SET recurrence='mensal' WHERE series_id=sid;
 BEGIN
  PERFORM public.edit_payables_series_cp04(company,selected,'all',180,'2026-12-20',snapshot);
  RAISE EXCEPTION 'Recurrence-only stale snapshot accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Recurrence-only stale snapshot accepted' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'CP04.1 legacy cadence, no recurrence coercion, stale snapshot PASSED';
END;
$test$;
ROLLBACK;
