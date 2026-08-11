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

import { Route } from '../../routes/api/public/stripe-webhook';

describe('Stripe Checkout Expired Fast Path - Strict Scalar Parser', () => {
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

  it('processed_plain_text_200_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'processed'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('json_scalar_duplicate_200_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '"duplicate"'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(200);
  });

  it('number_body_500_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '123'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_RESPONSE_INVALID');
  });

  it('boolean_body_500_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'true'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_RESPONSE_INVALID');
  });

  it('null_body_500_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'null'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_RESPONSE_INVALID');
  });

  it('empty_body_500_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ''
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_RESPONSE_INVALID');
  });

  it('http_204_500_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => ''
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_RESPONSE_INVALID');
  });

  it('rpc_non_2xx_503_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
  });

  it('rpc_timeout_503_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockRejectedValue(new Error('Fetch timeout'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_TRANSPORT_FAILED');
  });

  it('generic_rpc_not_called_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'processed'
    });
    await getHandler()({ request: createMockRequest('{}') });
    const calls = (global.fetch as any).mock.calls;
    const hasGenericRpcCall = calls.some((call: any) => call[0].includes('process_stripe_webhook_event'));
    expect(hasGenericRpcCall).toBe(false);
  });

  it('json_scalar_failed_retryable_503_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '"failed_retryable"'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_REJECTED_RETRYABLE');
  });

  it('array_body_500_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '["processed"]'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    expect(response.status).toBe(500);
  });
});