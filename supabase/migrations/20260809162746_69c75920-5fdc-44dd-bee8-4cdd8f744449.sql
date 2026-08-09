UPDATE public.checkout_attempts
SET status = 'open',
    updated_at = now()
WHERE id = 'd29b208a-ce60-4357-985d-ecb9ae7a2d52'
  AND empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90'
  AND status = 'creating';