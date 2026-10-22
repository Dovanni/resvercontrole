\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE public.payables(
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL, user_id uuid NOT NULL,
 series_id uuid,series_index integer,series_total integer,
 amount numeric(12,2) NOT NULL,due_date date NOT NULL,
 status text NOT NULL,paid_amount numeric(12,2) DEFAULT 0,paid_at timestamptz
);
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp04_select ON public.payables FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()));
CREATE POLICY cp04_update ON public.payables FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,UPDATE ON public.payables TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TYPE public.app_role AS ENUM ('admin','vendedor','financeiro');
CREATE TABLE public.empresas (id uuid PRIMARY KEY,status text NOT NULL);
CREATE TABLE public.user_company_access (id uuid PRIMARY KEY,user_id uuid NOT NULL,empresa_id uuid NOT NULL REFERENCES public.empresas(id),status text NOT NULL,role public.app_role NOT NULL);
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp04_membership ON public.user_company_access FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp04_company ON public.empresas FOR SELECT TO authenticated USING
 (EXISTS (SELECT 1 FROM public.user_company_access m WHERE m.empresa_id=public.empresas.id AND m.user_id=(SELECT auth.uid()) AND m.status='active'));
GRANT SELECT ON public.empresas,public.user_company_access TO authenticated;
INSERT INTO public.empresas VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','active');
INSERT INTO public.user_company_access VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active','financeiro'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','active','admin');
INSERT INTO public.payables VALUES
 ('00000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,3,94.47,'2026-01-31','pendente',0,NULL),
 ('00000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,3,94.47,'2026-02-28','pendente',0,NULL),
 ('00000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',3,3,94.47,'2026-03-31','pendente',0,NULL),
 ('00000000-0000-4000-8000-000000000004','cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,2,10,'2026-01-31','pendente',0,NULL);
