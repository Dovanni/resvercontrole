\set ON_ERROR_STOP on
CREATE TABLE public.empresas(id uuid PRIMARY KEY,status text NOT NULL);
CREATE TYPE public.app_role AS ENUM ('admin','vendedor','financeiro');
CREATE TABLE public.user_company_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,empresa_id uuid NOT NULL REFERENCES public.empresas(id),status text NOT NULL,role public.app_role NOT NULL);
CREATE TABLE public.payables(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),series_id uuid,series_index integer,series_total integer,
 amount numeric(12,2) NOT NULL,due_date date NOT NULL,status text NOT NULL,
 paid_amount numeric(12,2) NOT NULL DEFAULT 0,paid_at timestamptz
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp04_member ON public.user_company_access FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY cp04_company ON public.empresas FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.user_company_access m WHERE m.empresa_id=public.empresas.id AND m.user_id=(SELECT auth.uid()) AND m.status='active'));
CREATE POLICY cp04_read ON public.payables FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY cp04_write ON public.payables FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
GRANT SELECT ON public.empresas,public.user_company_access TO authenticated;
GRANT SELECT,UPDATE ON public.payables TO authenticated;
INSERT INTO public.empresas VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','active');
