import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock do fetch
global.fetch = vi.fn();

// 2. Mock do Stripe
const mockStripeInstance = {
  webhooks: {
    constructEventAsync: vi.fn(),
  },
  httpClient: {},
};

vi.mock('stripe', () => {
  const MockStripe: any = function(this: any) {
    this.webhooks = mockStripeInstance.webhooks;
    this.httpClient = mockStripeInstance.httpClient;
  };
  MockStripe.createFetchHttpClient = vi.fn().mockReturnValue({});
  MockStripe.createSubtleCryptoProvider = vi.fn().mockReturnValue({});
  return {
    default: MockStripe,
    createFetchHttpClient: MockStripe.createFetchHttpClient,
    createSubtleCryptoProvider: MockStripe.createSubtleCryptoProvider,
  };
});

import Stripe from 'stripe';
import { Route } from '../../routes/api/public/stripe-webhook';

describe('Stripe Checkout Expired Fast Path - Contract Resilience', () => {
  const mockTraceId = 'test-trace-id';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
    vi.stubEnv('STRIPE_RESTRICTED_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
    vi.stubEnv('STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED', 'false');
    vi.stubEnv('STRIPE_PRICE_ENTERPRISE_MONTHLY', 'price_123');
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockTraceId as any);
  });

  const createMockRequest = (body: string) => {
    return {
      headers: { get: (name: string) => (name === 'stripe-signature' ? 'valid_sig' : null) },
      text: async () => body
    } as any;
  };

  const getHandler = () => (Route.options.server?.handlers as any).POST;

  const setupMockEvent = () => {
    (mockStripeInstance.webhooks.constructEventAsync as any).mockResolvedValue({
      id: 'evt_test_123',
      type: 'checkout.session.expired',
      livemode: false,
      created: 123456789,
      data: { object: { id: 'cs_test_abc123' } }
    });
  };

  it('postgrest_processed_shape_200_test: should handle raw string "processed"', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => 'processed'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('postgrest_array_shape_200_test: should handle PostgREST array wrapped object', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ process_stripe_checkout_session_expired: 'processed' }]
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('postgrest_duplicate_shape_200_test: should handle "duplicate"', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => 'duplicate'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('postgrest_already_expired_shape_200_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => 'already_expired' });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('postgrest_ignored_terminal_shape_200_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => 'ignored_terminal' });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('postgrest_failed_retryable_shape_503_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => 'failed_retryable' });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(503);
  });

  it('postgrest_empty_array_contract_test: should return 500', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => []
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
  });

  it('postgrest_malformed_body_contract_test: should handle JSON parse error with 500', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new Error('JSON Error'); }
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_RESPONSE_INVALID');
  });

  it('postgrest_204_contract_test_if_applicable: should handle success void as processed', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({})
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('rpc_non_2xx_sanitized_test: should return 500 and not leak', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Database Error: Secret leaked!'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_RESPONSE_INVALID');
  });
});
