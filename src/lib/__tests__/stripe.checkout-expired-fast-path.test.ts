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
  const MockStripe = vi.fn().mockImplementation(() => mockStripeInstance);
  (MockStripe as any).createFetchHttpClient = vi.fn().mockReturnValue({});
  (MockStripe as any).createSubtleCryptoProvider = vi.fn().mockReturnValue({});
  
  return {
    default: MockStripe,
    createFetchHttpClient: (MockStripe as any).createFetchHttpClient,
    createSubtleCryptoProvider: (MockStripe as any).createSubtleCryptoProvider,
  };
});

import Stripe from 'stripe';
import { Route } from '../../routes/api/public/stripe-webhook';

describe('Stripe Checkout Expired Fast Path', () => {
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

  const createMockRequest = (body: string, signature: string = 'valid_sig') => {
    return {
      headers: {
        get: (name: string) => {
          if (name === 'stripe-signature') return signature;
          return null;
        }
      },
      text: async () => body
    } as any;
  };

  const getHandler = () => {
    const handlers = Route.options.server?.handlers;
    return (handlers as any).POST;
  };

  it('should process checkout.session.expired via fast path and return 200', async () => {
    (mockStripeInstance.webhooks.constructEventAsync as any).mockResolvedValue({
      id: 'evt_test_123',
      type: 'checkout.session.expired',
      livemode: false,
      created: 123456789,
      data: {
        object: {
          id: 'cs_test_abc123'
        }
      }
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => 'processed'
    });

    const handler = getHandler();
    const req = createMockRequest(JSON.stringify({ id: 'evt_test_123' }));
    const response = await handler({ request: req });
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.trace_id).toBe(mockTraceId);
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/rpc/process_stripe_checkout_session_expired'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"p_provider_session_id":"cs_test_abc123"')
      })
    );
  });

  it('should reject livemode=true events with 400', async () => {
    (mockStripeInstance.webhooks.constructEventAsync as any).mockResolvedValue({
      id: 'evt_test_124',
      type: 'checkout.session.expired',
      livemode: true,
      created: 123456789
    });

    const handler = getHandler();
    const req = createMockRequest(JSON.stringify({}));
    const response = await handler({ request: req });
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('LIVEMODE_REJECTED');
  });

  it('should return 503 when RPC fails with failed_retryable', async () => {
    (mockStripeInstance.webhooks.constructEventAsync as any).mockResolvedValue({
      id: 'evt_test_125',
      type: 'checkout.session.expired',
      livemode: false,
      created: 123456789,
      data: { object: { id: 'cs_test_abc' } }
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => 'failed_retryable'
    });

    const handler = getHandler();
    const req = createMockRequest(JSON.stringify({}));
    const response = await handler({ request: req });
    
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_REJECTED_RETRYABLE');
  });

  it('should verify that other events still call the generic RPC', async () => {
    (mockStripeInstance.webhooks.constructEventAsync as any).mockResolvedValue({
      id: 'evt_test_completed',
      type: 'checkout.session.completed',
      livemode: false,
      created: 123456789,
      data: { 
        object: { 
          id: 'cs_test_completed',
          metadata: { plan_code: 'enterprise_monthly' }
        } 
      }
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'processed' })
    });

    const handler = getHandler();
    const req = createMockRequest(JSON.stringify({}));
    const response = await handler({ request: req });
    
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/rpc/process_stripe_webhook_event'),
      expect.any(Object)
    );
  });
});
