
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';

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

// Import the handler
import { Route } from '../../routes/api/public/stripe-webhook';

describe('Trace 6bd7dc10 Reproduction - Fast Path Pre-ACK Diagnosis', () => {
  const mockTraceId = '6bd7dc10-2940-4f4f-9adf-27aecd04236d';
  
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['VITE_SUPABASE_URL'] = 'http://localhost:54321';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-key';
    process.env['STRIPE_RESTRICTED_KEY'] = 'sk_test_123';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test';
    process.env['STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED'] = 'false';
    process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] = 'price_123';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockTraceId as any);
  });

  const createMockRequest = (body: string) => {
    return {
      headers: { 
        get: (name: string) => {
          if (name === 'stripe-signature') return 'valid_sig';
          return null;
        } 
      },
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

  it('valid_event_scalar_duplicate_200', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '"duplicate"'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stage).toBe('HTTP_RESPONSE_CREATED');
  });

  it('payload_hash_success', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '"processed"'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stage).toBe('HTTP_RESPONSE_CREATED');
  });

  it('missing_supabase_url_sanitized', async () => {
    setupMockEvent();
    delete process.env['VITE_SUPABASE_URL'];
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.reason_code).toBe('UNEXPECTED_HANDLER_FAILURE');
    // Em F4 corrigido, o stage deve refletir até onde chegou
    expect(body.stage).toBe('PAYLOAD_HASH_CREATED');
  });

  it('fetch_network_rejection_503', async () => {
    setupMockEvent();
    (global.fetch as any).mockRejectedValue(new Error('Network failure'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
    expect(body.stage).toBe('RPC_CALL_STARTED');
  });

  it('fetch_timeout_503', async () => {
    setupMockEvent();
    (global.fetch as any).mockRejectedValue(new Error('Timeout'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
    expect(body.stage).toBe('RPC_CALL_STARTED');
  });

  it('rpc_http_non_2xx_503', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
    expect(body.stage).toBe('RPC_RESPONSE_RECEIVED');
  });

  it('rpc_scalar_ack_200', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'processed'
    });
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stage).toBe('HTTP_RESPONSE_CREATED');
  });
  
  it('CRITICAL_PRODUCTION_SIMULATION_F958', async () => {
    setupMockEvent();
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '"duplicate"'
    });
    
    const response = await getHandler()({ request: createMockRequest('{"id":"evt_123"}') });
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.stage).toBe('HTTP_RESPONSE_CREATED');
    expect(body.reason_code).toBeUndefined();
    
    // Validar que apenas a Fast Path RPC foi chamada
    const calls = fetchSpy.mock.calls;
    const fastPathCalls = calls.filter(c => c[0].toString().includes('process_stripe_checkout_session_expired'));
    const genericPathCalls = calls.filter(c => c[0].toString().includes('process_stripe_webhook_event'));
    
    expect(fastPathCalls.length).toBe(1);
    expect(genericPathCalls.length).toBe(0);
  });
});
