\set ON_ERROR_STOP on
CREATE TABLE public.empresas(id uuid PRIMARY KEY,status text NOT NULL);
CREATE TYPE public.app_role AS ENUM ('admin','vendedor','financeiro');
CREATE TABLE public.user_company_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,empresa_id uuid NOT NULL REFERENCES public.empresas(id),status text NOT NULL,role public.app_role NOT NULL);
CREATE TABLE public.payables(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),series_id uuid,series_index integer,series_total integer,
 amount numeric(12,2) NOT NULL,due_date date NOT NULL,status text NOT NULL,recurrence text NOT NULL DEFAULT 'mensal',
 paid_amount numeric(12,2) NOT NULL DEFAULT 0,paid_at timestamptz
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp04_member ON public.user_company_access FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY cp04_company ON public.empresas FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.user_company_access m WHERE m.empresa_id=public.empresas.id AND m.user_id=(SELECT auth.uid()) AND m.status='active'));
CREATE POLICY "cp04_read_own_payables" ON public.payables
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()));
CREATE POLICY "cp04_insert_financial_member" ON public.payables
 FOR INSERT TO authenticated WITH CHECK (
  user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
  )
 );
CREATE POLICY "cp04_update_financial_member" ON public.payables
 FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
 ))
 WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
 ));
CREATE POLICY "cp04_delete_financial_member" ON public.payables
 FOR DELETE TO authenticated USING (
  user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
  )
 );
GRANT SELECT ON public.empresas,public.user_company_access TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.payables TO authenticated;
INSERT INTO public.empresas VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','active');

-- CP-04 / REVIEW ONLY. DO NOT EXECUTE IN PRODUCTION WITHOUT RELEASE GATE.
-- Guard financial metadata of already-settled/partially paid payables.
-- Deliberately permits the ordinary payment workflow to update status,
-- paid_amount and paid_at (including controlled reversals); does not change
-- the existing payment workflow. A separate audit should cover reversals.
CREATE OR REPLACE FUNCTION public.cp04_protect_settled_payable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
  IF OLD.status IN ('pago','cancelado') OR coalesce(OLD.paid_amount,0)<>0 OR OLD.paid_at IS NOT NULL THEN
   RAISE EXCEPTION 'Settled or partially paid payable cannot be deleted' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
 END IF;
 IF OLD.status IN ('pago','cancelado') OR coalesce(OLD.paid_amount,0)<>0 OR OLD.paid_at IS NOT NULL THEN
  IF ROW(NEW.amount,NEW.due_date,NEW.description,NEW.supplier_id,NEW.category,
         NEW.payment_method,NEW.bank_account_id,NEW.recurrence,NEW.empresa_id,NEW.user_id)
     IS DISTINCT FROM
     ROW(OLD.amount,OLD.due_date,OLD.description,OLD.supplier_id,OLD.category,
         OLD.payment_method,OLD.bank_account_id,OLD.recurrence,OLD.empresa_id,OLD.user_id)
  THEN
   RAISE EXCEPTION 'Settled or partially paid payable financial metadata is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cp04_protect_settled_payable_trg ON public.payables;
CREATE TRIGGER cp04_protect_settled_payable_trg
 BEFORE UPDATE OR DELETE ON public.payables
 FOR EACH ROW EXECUTE FUNCTION public.cp04_protect_settled_payable();
REVOKE ALL ON FUNCTION public.cp04_protect_settled_payable() FROM PUBLIC,anon,authenticated;
-- Note: no attempt to grant Matriz superuser access via RLS. Matriz's
-- administration endpoint is separately authorized using server-side IDs.
