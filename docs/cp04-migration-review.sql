-- REVIEW-ONLY migration proposal; NOT APPLIED TO SUPABASE.
-- Generate the canonical migration filename with the Supabase CLI before promotion.
-- Safe for legacy: nullable identity; no automatic backfill by description.
BEGIN;
ALTER TABLE public.payables
  ADD COLUMN series_id uuid,
  ADD COLUMN series_index integer,
  ADD COLUMN series_total integer;
ALTER TABLE public.payables ADD CONSTRAINT payables_series_identity_consistency
CHECK (
  (series_id IS NULL AND series_index IS NULL AND series_total IS NULL)
  OR (series_id IS NOT NULL AND series_index IS NOT NULL AND series_total IS NOT NULL
      AND series_total BETWEEN 2 AND 120
      AND series_index BETWEEN 1 AND series_total)
);
CREATE UNIQUE INDEX payables_series_identity_unique
  ON public.payables(empresa_id, series_id, series_index)
  WHERE series_id IS NOT NULL;
CREATE INDEX payables_series_identity_lookup
  ON public.payables(empresa_id, user_id, series_id)
  WHERE series_id IS NOT NULL;
COMMIT;
-- Gate: verify empresa_id non-null and indexes/constraints on target before running.
-- Gate: creation of new installment series must become atomic and write UUID identity.
-- Gate: RLS policy currently user-only; verify membership of empresa_id at server boundary.
-- Gate: no production execution until explicit approval and isolated integration tests.
