\set ON_ERROR_STOP on
-- CP-04: entirely synthetic database, ephemeral GitHub Actions PostgreSQL.
CREATE SCHEMA cp04;
CREATE TABLE cp04.payables (
  id integer PRIMARY KEY,
  empresa_id integer NOT NULL,
  user_id integer NOT NULL,
  series_id integer,
  series_index integer,
  series_total integer,
  amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT series_fields CHECK (
    (series_id IS NULL AND series_index IS NULL AND series_total IS NULL) OR
    (series_id IS NOT NULL AND series_index BETWEEN 1 AND series_total AND series_total >= 2)
  )
);
CREATE UNIQUE INDEX cp04_unique_series_index ON cp04.payables(empresa_id,series_id,series_index)
 WHERE series_id IS NOT NULL;

CREATE FUNCTION cp04.edit_series(
 p_company integer, p_user integer, p_selected integer,
 p_scope text, p_amount numeric, p_anchor date, p_expected integer[],
 p_inject_failure boolean DEFAULT false
) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_selected cp04.payables%ROWTYPE;
 v_count integer;
 v_ids integer[];
 v_updated integer;
BEGIN
 IF p_scope NOT IN ('single','future','all') OR p_scope IS NULL THEN
   RAISE EXCEPTION 'invalid scope';
 END IF;
 IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount,2) OR p_anchor IS NULL THEN
   RAISE EXCEPTION 'invalid input';
 END IF;
 SELECT * INTO v_selected FROM cp04.payables
  WHERE id=p_selected AND empresa_id=p_company AND user_id=p_user;
 IF NOT FOUND OR v_selected.series_id IS NULL THEN RAISE EXCEPTION 'series not found'; END IF;
 IF v_selected.status NOT IN ('pendente','atrasado') OR v_selected.paid_amount <> 0 THEN
   RAISE EXCEPTION 'selected row is settled';
 END IF;
 -- Lock all rows of this series before validating, including settled rows.
 PERFORM id FROM cp04.payables
  WHERE empresa_id=p_company AND series_id=v_selected.series_id
  ORDER BY id FOR UPDATE;
 SELECT count(*) INTO v_count FROM cp04.payables
  WHERE empresa_id=p_company AND user_id=p_user AND series_id=v_selected.series_id;
 IF v_count <> v_selected.series_total OR EXISTS (
  SELECT 1 FROM cp04.payables
   WHERE empresa_id=p_company AND series_id=v_selected.series_id AND user_id<>p_user
 ) THEN RAISE EXCEPTION 'ambiguous or incomplete series'; END IF;
 SELECT array_agg(id ORDER BY series_index) INTO v_ids FROM cp04.payables
  WHERE empresa_id=p_company AND user_id=p_user AND series_id=v_selected.series_id
    AND status IN ('pendente','atrasado') AND paid_amount=0
    AND (p_scope='all' OR series_index>=v_selected.series_index)
    AND (p_scope<>'single' OR id=p_selected);
 IF v_ids IS NULL OR v_ids IS DISTINCT FROM p_expected THEN
  RAISE EXCEPTION 'stale preview';
 END IF;
 UPDATE cp04.payables p
  SET amount=p_amount,
      due_date=(
        date_trunc('month', p_anchor)::date
        + make_interval(months => p.series_index-v_selected.series_index)
        + (least(extract(day from p_anchor)::integer,
            extract(day from (
              date_trunc('month', p_anchor)::date
              + make_interval(months => p.series_index-v_selected.series_index+1)
              - interval '1 day'))::integer)-1) * interval '1 day'
      )::date
  WHERE p.id=ANY(v_ids) AND p.empresa_id=p_company AND p.user_id=p_user
    AND p.status IN ('pendente','atrasado') AND p.paid_amount=0;
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 IF v_updated <> cardinality(v_ids) THEN RAISE EXCEPTION 'partial update'; END IF;
 IF p_inject_failure THEN RAISE EXCEPTION 'injected rollback test'; END IF;
 RETURN v_updated;
END;
$$;

INSERT INTO cp04.payables(id,empresa_id,user_id,series_id,series_index,series_total,amount,due_date,status,paid_amount) VALUES
 (1,10,20,100,1,4,94.47,'2026-01-31','pendente',0),
 (2,10,20,100,2,4,94.47,'2026-02-28','pago',94.47),
 (3,10,20,100,3,4,94.47,'2026-03-31','pendente',0),
 (4,10,20,100,4,4,94.47,'2026-04-30','pendente',10),
 (5,10,20,200,1,2,94.47,'2026-01-31','pendente',0),
 (6,10,20,200,2,2,94.47,'2026-02-28','pendente',0),
 (7,11,20,100,1,2,94.47,'2026-01-31','pendente',0),
 (8,11,20,100,2,2,94.47,'2026-02-28','pendente',0);

DO $$
DECLARE n integer;
BEGIN
 SELECT cp04.edit_series(10,20,1,'all',100,'2026-01-31',ARRAY[1,3]) INTO n;
 IF n<>2 THEN RAISE EXCEPTION 'wrong update count'; END IF;
 IF (SELECT amount FROM cp04.payables WHERE id=1)<>100 OR
    (SELECT amount FROM cp04.payables WHERE id=3)<>100 OR
    (SELECT due_date FROM cp04.payables WHERE id=3)<>'2026-03-31' THEN
   RAISE EXCEPTION 'amount or monthly calendar wrong';
 END IF;
 IF EXISTS(SELECT 1 FROM cp04.payables WHERE id IN (2,4,5,6,7,8) AND amount<>94.47) THEN
   RAISE EXCEPTION 'settled, unrelated or other-company row changed';
 END IF;
 BEGIN
  PERFORM cp04.edit_series(10,20,1,'all',150,'2026-01-31',ARRAY[1,3],true);
  RAISE EXCEPTION 'injected error not thrown';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'injected rollback test' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM cp04.payables WHERE id IN (1,3) AND amount<>100) THEN
   RAISE EXCEPTION 'rollback failed';
 END IF;
 BEGIN
  PERFORM cp04.edit_series(10,20,1,'all',150,'2026-01-31',ARRAY[1,3,4]);
  RAISE EXCEPTION 'stale preview not rejected';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'stale preview' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM cp04.edit_series(10,21,1,'all',150,'2026-01-31',ARRAY[1,3]);
  RAISE EXCEPTION 'cross-user update not rejected';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'series not found' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'CP04 ISOLATED SQL TESTS PASSED';
END $$;
