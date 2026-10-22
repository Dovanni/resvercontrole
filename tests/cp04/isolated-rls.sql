\set ON_ERROR_STOP on
-- Emulate Supabase JWT auth.uid() in a disposable PostgreSQL service.
-- This verifies Postgres RLS enforcement; it is NOT a live Supabase Auth integration test.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE ROLE cp04_authenticated NOLOGIN;
GRANT USAGE ON SCHEMA auth TO cp04_authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO cp04_authenticated;
CREATE SCHEMA cp04_security;
GRANT USAGE ON SCHEMA cp04_security TO cp04_authenticated;
CREATE TABLE cp04_security.payables (
 id integer PRIMARY KEY,
 empresa_id integer NOT NULL,
 user_id uuid NOT NULL,
 amount numeric(12,2) NOT NULL
);
GRANT SELECT,UPDATE ON cp04_security.payables TO cp04_authenticated;
ALTER TABLE cp04_security.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp04_security.payables FORCE ROW LEVEL SECURITY;
CREATE POLICY cp04_owner_company_select ON cp04_security.payables
 FOR SELECT TO cp04_authenticated
 USING (user_id=(SELECT auth.uid()) AND empresa_id=10);
CREATE POLICY cp04_owner_company_update ON cp04_security.payables
 FOR UPDATE TO cp04_authenticated
 USING (user_id=(SELECT auth.uid()) AND empresa_id=10)
 WITH CHECK (user_id=(SELECT auth.uid()) AND empresa_id=10);
INSERT INTO cp04_security.payables VALUES
 (1,10,'11111111-1111-4111-8111-111111111111',10),
 (2,11,'11111111-1111-4111-8111-111111111111',10),
 (3,10,'22222222-2222-4222-8222-222222222222',10);
SET ROLE cp04_authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM cp04_security.payables) <> 1 THEN
   RAISE EXCEPTION 'RLS leaked other user/company rows';
 END IF;
 UPDATE cp04_security.payables SET amount=20 WHERE id IN (1,2,3);
 IF (SELECT amount FROM cp04_security.payables WHERE id=1)<>20 THEN
   RAISE EXCEPTION 'authorized update failed';
 END IF;
 IF EXISTS(SELECT 1 FROM cp04_security.payables WHERE id IN (2,3)) THEN
   RAISE EXCEPTION 'cross-tenant row visible';
 END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM cp04_security.payables WHERE id IN (2,3) AND amount<>10)<>2 THEN
  RAISE EXCEPTION 'RLS allowed cross-tenant update';
 END IF;
END $$;
SET ROLE cp04_authenticated;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM cp04_security.payables) THEN
   RAISE EXCEPTION 'unauthenticated access';
 END IF;
END $$;
RESET ROLE;
\echo CP04 RLS ROLE SIMULATION PASSED
