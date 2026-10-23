-- CP-04 / REVIEW ONLY. DO NOT EXECUTE IN PRODUCTION WITHOUT RELEASE GATE.
-- Guard financial metadata of already-settled/partially paid payables.
-- Deliberately permits the ordinary payment workflow to update status,
-- paid_amount and paid_at (including controlled reversals); does not change
-- the existing payment workflow. A separate audit should cover reversals.
BEGIN;
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
COMMIT;
-- Note: no attempt to grant Matriz superuser access via RLS. Matriz's
-- administration endpoint is separately authorized using server-side IDs.
