-- Adding check constraint after reconciliation
ALTER TABLE public.checkout_attempts
ADD CONSTRAINT checkout_attempts_open_status_requires_session_id
CHECK (
  status <> 'open'
  OR provider_checkout_session_id IS NOT NULL
);