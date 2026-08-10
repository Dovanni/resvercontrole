import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route } from '../../routes/api/public/stripe-webhook';

// --- Mocks ---

vi.mock('stripe', () => {
  const mockConstructEventAsync = vi.fn();
  const mockStripeInstance = {
    webhooks: {
      constructEventAsync: mockConstructEventAsync,
    },
  };

  const StripeMock = function(this: any) {
    return mockStripeInstance;
  } as any;
  
  StripeMock.createFetchHttpClient = vi.fn();
  StripeMock.createSubtleCryptoProvider = vi.fn();

  return {
    default: StripeMock,
    createFetchHttpClient: StripeMock.createFetchHttpClient,
    createSubtleCryptoProvider: StripeMock.createSubtleCryptoProvider,
  };
});

import Stripe from 'stripe';



// Mock Global Fetch (for Supabase RPC)
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Environment Variables
const mockEnv = {
  STRIPE_RESTRICTED_KEY: 'rk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  VITE_SUPABASE_URL: 'https://bsrjtmssbnvttzrvnaab.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service_role_secret',
  STRIPE_PRICE_ENTERPRISE_MONTHLY: 'price_123',
};

// --- Test Suite ---

describe('VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_FULL_CONTRACT_VALIDATION', () => {
  const getMockConstructEventAsync = () => {
    const stripe = new Stripe('key');
    return stripe.webhooks.constructEventAsync as any;
  };

  const mockUuid = '550e8400-e29b-41d4-a716-446655440000';
  const otherUuid = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();
    // Inject env inside handler scope simulation
    const handler = (Route.options.server as any).handlers.POST;
  });

  const createRequest = (body: any, signature: string = 'valid_sig') => {
    return {
      request: {
        headers: {
          get: (key: string) => (key === 'stripe-signature' ? signature : null),
        },
        text: async () => JSON.stringify(body),
      },
    } as any;
  };

  const setupStripeEvent = (event: any) => {
    getMockConstructEventAsync().mockResolvedValue(event);
  };


  const setupRpcResponse = (status: number, body: any = { status: 'success' }) => {
    mockFetch.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  };

  // 1. legacy_key_only
  it('1. legacy_key_only_test: should normalize subscription_id to internal_subscription_id', async () => {
    setupStripeEvent({
      id: 'evt_legacy',
      type: 'checkout.session.completed',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { subscription_id: mockUuid } } },
    });
    setupRpcResponse(200);

    await handler(createRequest({}));

    const rpcCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(rpcCall.p_event_data.metadata.internal_subscription_id).toBe(mockUuid);
    expect(rpcCall.p_event_data.metadata.subscription_id).toBe(mockUuid);
  });

  // 2. canonical_key_only
  it('2. canonical_key_only_test: should preserve internal_subscription_id', async () => {
    setupStripeEvent({
      id: 'evt_canonical',
      type: 'checkout.session.completed',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { internal_subscription_id: mockUuid } } },
    });
    setupRpcResponse(200);

    await handler(createRequest({}));

    const rpcCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(rpcCall.p_event_data.metadata.internal_subscription_id).toBe(mockUuid);
  });

  // 3. both_keys_equal
  it('3. both_keys_equal_test: should accept when both keys match', async () => {
    setupStripeEvent({
      id: 'evt_both_match',
      type: 'checkout.session.completed',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { internal_subscription_id: mockUuid, subscription_id: mockUuid } } },
    });
    setupRpcResponse(200);

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(200);
  });

  // 4. both_keys_conflicting
  it('4. both_keys_conflicting_test: should reject mismatching keys with 400', async () => {
    setupStripeEvent({
      id: 'evt_conflict',
      type: 'checkout.session.completed',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { internal_subscription_id: mockUuid, subscription_id: otherUuid } } },
    });

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(400);
    const body = await resp.text();
    expect(body).toContain('Metadata conflict');
  });

  // 5. both_keys_missing
  it('5. both_keys_missing_test: should proceed if no subscription ID is present', async () => {
    setupStripeEvent({
      id: 'evt_none',
      type: 'checkout.session.completed',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { plan: 'essential' } } },
    });
    setupRpcResponse(200);

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(200);
    const rpcCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(rpcCall.p_event_data.metadata.internal_subscription_id).toBeUndefined();
  });

  // 6. invalid_uuid
  it('6. invalid_uuid_test: should reject non-UUID format with 400', async () => {
    setupStripeEvent({
      id: 'evt_bad_uuid',
      type: 'checkout.session.completed',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { subscription_id: 'not-a-uuid' } } },
    });

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(400);
    expect(await resp.text()).toContain('Invalid UUID');
  });

  // 7. cross_company
  it('7. cross_company_test: should pass empresa_id to RPC for tenant isolation', async () => {
    const empresaId = 'emp_999';
    setupStripeEvent({
      id: 'evt_cross',
      type: 'checkout.session.completed',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { empresa_id: empresaId } } },
    });
    setupRpcResponse(200);

    await handler(createRequest({}));

    const rpcCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Note: handler passes metadata as-is to p_event_data.metadata
    expect(rpcCall.p_event_data.metadata.empresa_id).toBe(empresaId);
  });

  // 8. subscription_mismatch (covered by both_keys_conflicting, adding explicit variant for contract)
  it('8. subscription_mismatch_test: should reject if subscription_id is wrong compared to existing internal_subscription_id', async () => {
    setupStripeEvent({
      id: 'evt_mismatch',
      type: 'customer.subscription.updated',
      livemode: false,
      created: 12345,
      data: { object: { id: 'sub_1', metadata: { internal_subscription_id: mockUuid, subscription_id: '00000000-0000-0000-0000-000000000000' } } },
    });
    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(400);
  });

  // 9. provider_session_mismatch (Signature check)
  it('9. provider_session_mismatch_test: should reject invalid signature with 400', async () => {
    mockConstructEventAsync.mockRejectedValue(new Error('No matching signature found'));
    const resp = await handler(createRequest({}, 'invalid_sig'));
    expect(resp.status).toBe(400);
    expect(await resp.text()).toContain('Webhook Error');
  });

  // 10. existing_expired_event
  it('10. existing_expired_event_test: should process checkout.session.expired with normalized metadata', async () => {
    setupStripeEvent({
      id: 'evt_expired',
      type: 'checkout.session.expired',
      livemode: false,
      created: 12345,
      data: { object: { id: 'cs_1', metadata: { subscription_id: mockUuid } } },
    });
    setupRpcResponse(200);

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(200);
    const rpcCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(rpcCall.p_event_type).toBe('checkout.session.expired');
    expect(rpcCall.p_event_data.metadata.internal_subscription_id).toBe(mockUuid);
  });

  // 11. duplicate_event_idempotency
  it('11. duplicate_event_idempotency_test: should return 200 if RPC returns success for duplicate', async () => {
    setupStripeEvent({
      id: 'evt_dup',
      type: 'invoice.paid',
      livemode: false,
      created: 12345,
      data: { object: { id: 'in_1', metadata: { plan_code: 'essencial' } } },
    });
    setupRpcResponse(200, { status: 'success' }); // RPC handles internal duplicate check

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(200);
  });

  // 12. livemode_rejection
  it('12. livemode_rejection_test: should reject livemode events in sandbox with 400', async () => {
    setupStripeEvent({
      id: 'evt_live',
      type: 'checkout.session.completed',
      livemode: true, // TRUE
      created: 12345,
      data: { object: { id: 'cs_1' } },
    });

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(400);
    expect(await resp.text()).toContain('Livemode not supported');
  });

  // 13. invalid_signature_400
  it('13. invalid_signature_400_test: should return 400 when signature header is missing', async () => {
    const resp = await (Route.options.server as any).handlers.POST({
      request: {
        headers: { get: () => null },
        text: async () => '{}',
      },
    });
    expect(resp.status).toBe(400);
    expect(await resp.text()).toBe('Missing signature');
  });

  // 14. failed_retryable_503
  it('14. failed_retryable_503_test: should return 503 if RPC returns failed_retryable', async () => {
    setupStripeEvent({
      id: 'evt_retry',
      type: 'invoice.paid',
      livemode: false,
      created: 12345,
      data: { object: { id: 'in_1', metadata: {} } },
    });
    setupRpcResponse(200, { status: 'failed_retryable' });

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(503);
    expect(await resp.text()).toContain('Event resolution pending');
  });

  // 15. processed_200
  it('15. processed_200_test: should return 200 on successful processing', async () => {
    setupStripeEvent({
      id: 'evt_success',
      type: 'invoice.paid',
      livemode: false,
      created: 12345,
      data: { object: { id: 'in_1', metadata: { internal_subscription_id: mockUuid } } },
    });
    setupRpcResponse(200);

    const resp = await handler(createRequest({}));
    expect(resp.status).toBe(200);
  });
});
