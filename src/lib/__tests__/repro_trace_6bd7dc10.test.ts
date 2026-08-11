
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

describe('Trace 6bd7dc10 Forensic Runtime Diagnosis & Reproduction', () => {
  const mockTraceId = '6bd7dc10-2940-4f4f-9adf-27aecd04236d';
  
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['VITE_SUPABASE_URL'] = 'https://bsrjtmssbnvttzrvnaab.supabase.co';
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

  const mockResponse = (ok: boolean, status: number, body: string): any => ({
    ok,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
    headers: new Headers(),
    statusText: ok ? 'OK' : 'Error'
  });

  it('production_runtime_process_env_available_test', async () => {
    expect(typeof process).toBe('object');
    expect(typeof process.env).toBe('object');
  });

  it('valid_server_configuration_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue(mockResponse(true, 200, '"processed"'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stage).toBe('HTTP_RESPONSE_CREATED');
  });

  it('missing_supabase_url_500_test', async () => {
    setupMockEvent();
    const original = process.env['VITE_SUPABASE_URL'];
    delete process.env['VITE_SUPABASE_URL'];
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.reason_code).toBe('SERVER_CONFIGURATION_MISSING');
    expect(body.stage).toBe('SERVER_CONFIGURATION_VALIDATED');
    process.env['VITE_SUPABASE_URL'] = original;
  });

  it('invalid_supabase_url_500_test', async () => {
    setupMockEvent();
    const original = process.env['VITE_SUPABASE_URL'];
    process.env['VITE_SUPABASE_URL'] = 'not-a-url';
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.reason_code).toBe('SERVER_CONFIGURATION_INVALID');
    expect(body.stage).toBe('SERVER_CONFIGURATION_VALIDATED');
    process.env['VITE_SUPABASE_URL'] = original;
  });

  it('missing_service_role_key_500_test', async () => {
    setupMockEvent();
    const original = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.reason_code).toBe('SERVER_CONFIGURATION_MISSING');
    expect(body.stage).toBe('SERVER_CONFIGURATION_VALIDATED');
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = original;
  });

  it('empty_service_role_key_500_test', async () => {
    setupMockEvent();
    const original = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = '   ';
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.reason_code).toBe('SERVER_CONFIGURATION_INVALID');
    expect(body.stage).toBe('SERVER_CONFIGURATION_VALIDATED');
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = original;
  });

  it('crypto_digest_rejection_500_test', async () => {
    setupMockEvent();
    const originalDigest = crypto.subtle.digest;
    crypto.subtle.digest = vi.fn().mockRejectedValue(new Error('Crypto failed'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('UNEXPECTED_HANDLER_FAILURE');
    expect(body.stage).toBe('PAYLOAD_HASH_STARTED');
    crypto.subtle.digest = originalDigest;
  });

  it('fetch_network_rejection_503_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockRejectedValue(new Error('Network failure'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
    expect(body.stage).toBe('RPC_CALL_STARTED');
  });

  it('fetch_timeout_503_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockRejectedValue(new Error('Timeout'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
    expect(body.stage).toBe('RPC_CALL_STARTED');
  });

  it('rpc_non_2xx_503_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue(mockResponse(false, 502, 'Bad Gateway'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
    expect(body.stage).toBe('RPC_RESPONSE_RECEIVED');
  });

  it('scalar_duplicate_ack_200_test', async () => {
    setupMockEvent();
    (global.fetch as any).mockResolvedValue(mockResponse(true, 200, '"duplicate"'));
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stage).toBe('HTTP_RESPONSE_CREATED');
  });

  it('json_stringify_failure_500_test', async () => {
    setupMockEvent();
    const originalStringify = JSON.stringify;
    // We target only the JSON.stringify in the handler context if possible, but here we mock global
    JSON.stringify = vi.fn().mockImplementation((val) => {
      if (val && (val as any).p_provider_session_id === 'cs_test_abc123') {
        throw new Error('Stringify failed');
      }
      return originalStringify(val);
    });
    
    const response = await getHandler()({ request: createMockRequest('{}') });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
    expect(body.stage).toBe('RPC_CALL_STARTED');
    JSON.stringify = originalStringify;
  });
});
