BEGIN;
ALTER TABLE public.payment_events ALTER COLUMN provider SET NOT NULL;
ALTER TABLE public.payment_events ALTER COLUMN provider_event_id SET NOT NULL;
ALTER TABLE public.payment_events DROP CONSTRAINT IF EXISTS payment_events_provider_event_id_key;
ALTER TABLE public.payment_events ADD CONSTRAINT payment_events_provider_event_id_unique UNIQUE(provider, provider_event_id);

-- Test A: First occurrence accepted
INSERT INTO public.payment_events (empresa_id, provider, provider_event_id, event_type, payload_sha256)
VALUES ('c610705d-e900-4b6f-8460-1a0633b7962a', 'stripe', 'evt_test_001', 'test', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

-- Test B: Repetition ('stripe', 'evt_test_001') = idempotente via ON CONFLICT
INSERT INTO public.payment_events (empresa_id, provider, provider_event_id, event_type, payload_sha256)
VALUES ('c610705d-e900-4b6f-8460-1a0633b7962a', 'stripe', 'evt_test_001', 'test', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
ON CONFLICT (provider, provider_event_id) DO NOTHING;

-- Test C: Cross-provider same event ID ('outro_provedor', 'evt_test_001') = non-collision
INSERT INTO public.payment_events (empresa_id, provider, provider_event_id, event_type, payload_sha256)
VALUES ('c610705d-e900-4b6f-8460-1a0633b7962a', 'outro_provedor', 'evt_test_001', 'test', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

-- Cleanup
DELETE FROM public.payment_events WHERE provider_event_id = 'evt_test_001';
COMMIT;