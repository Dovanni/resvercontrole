
-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  op text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  row_id uuid,
  old_data jsonb,
  new_data jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own audit"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS audit_log_user_table_at_idx
  ON public.audit_log(user_id, table_name, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_row_idx
  ON public.audit_log(table_name, row_id);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_row_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_row_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user := NEW.user_id;
    v_row_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSE
    v_user := NEW.user_id;
    v_row_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_log (user_id, table_name, op, row_id, old_data, new_data)
  VALUES (v_user, TG_TABLE_NAME, TG_OP, v_row_id, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Attach to critical tables
DROP TRIGGER IF EXISTS audit_cartoes_lancamentos ON public.cartoes_lancamentos;
CREATE TRIGGER audit_cartoes_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.cartoes_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_payables ON public.payables;
CREATE TRIGGER audit_payables
  AFTER INSERT OR UPDATE OR DELETE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_receivables ON public.receivables;
CREATE TRIGGER audit_receivables
  AFTER INSERT OR UPDATE OR DELETE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_bank_movements ON public.bank_movements;
CREATE TRIGGER audit_bank_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_movements
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
