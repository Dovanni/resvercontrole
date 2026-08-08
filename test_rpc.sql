BEGIN;
-- Mock de auth.uid() para o usuário alvo
SET LOCAL "request.jwt.claims" = '{"sub": "1fcb4d6b-61bd-4af9-bf12-87c514094921"}';

SELECT public.reconcile_and_finalize_onboarding();

ROLLBACK;
