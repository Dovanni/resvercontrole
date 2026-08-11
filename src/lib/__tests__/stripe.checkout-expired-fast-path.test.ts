import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route } from '../routes/api/public/stripe-webhook';

// Mock do global fetch para simular Supabase RPC
global.fetch = vi.fn();

describe('Stripe Checkout Expired Fast Path', () => {
  const mockTraceId = 'test-trace-id';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
    vi.stubEnv('STRIPE_RESTRICTED_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
    vi.stubEnv('STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED', 'false');
    
    // Mock crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockTraceId as any);
  });

  const createMockRequest = (body: object, signature: string = 'valid_sig') => {
    return {
      headers: {
        get: (name: string) => {
          if (name === 'stripe-signature') return signature;
          return null;
        }
      },
      text: async () => JSON.stringify(body)
    } as any;
  };

  it('should process checkout.session.expired via fast path and return 200', async () => {
    // Mock Stripe constructEventAsync (manualmente ou via mock da lib)
    // Para simplificar o teste de unidade sem carregar a lib Stripe real:
    // mockamos o handler interno se necessário, ou mockamos a lib Stripe.
    
    // Como o handler importa Stripe, vamos mockar a classe Stripe.
    vi.mock('stripe', () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          webhooks: {
            constructEventAsync: vi.fn().mockResolvedValue({
              id: 'evt_test_123',
              type: 'checkout.session.expired',
              livemode: false,
              created: 123456789,
              data: {
                object: {
                  id: 'cs_test_abc123'
                }
              }
            })
          },
          httpClient: {}
        })),
        createFetchHttpClient: vi.fn(),
        createSubtleCryptoProvider: vi.fn()
      };
    });

    // Mock RPC Response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => 'processed'
    });

    const req = createMockRequest({ id: 'evt_test_123', type: 'checkout.session.expired' });
    const response = await (Route.options.server!.handlers!.POST as any)({ request: req });
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.trace_id).toBe(mockTraceId);
    expect(body.stage).toBe('HTTP_RESPONSE_READY');
    
    // Verificar se chamou a RPC correta
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/rpc/process_stripe_checkout_session_expired'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"p_provider_session_id":"cs_test_abc123"')
      })
    );
  });

  it('should reject livemode=true events with 400', async () => {
    vi.mock('stripe', () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          webhooks: {
            constructEventAsync: vi.fn().mockResolvedValue({
              id: 'evt_test_123',
              type: 'checkout.session.expired',
              livemode: true,
              created: 123456789
            })
          },
          httpClient: {}
        })),
        createFetchHttpClient: vi.fn(),
        createSubtleCryptoProvider: vi.fn()
      };
    });

    const req = createMockRequest({});
    const response = await (Route.options.server!.handlers!.POST as any)({ request: req });
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('LIVEMODE_REJECTED');
  });

  it('should return 503 when RPC fails with retryable status', async () => {
    vi.mock('stripe', () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          webhooks: {
            constructEventAsync: vi.fn().mockResolvedValue({
              id: 'evt_test_123',
              type: 'checkout.session.expired',
              livemode: false,
              created: 123456789,
              data: { object: { id: 'cs_test_abc' } }
            })
          },
          httpClient: {}
        })),
        createFetchHttpClient: vi.fn(),
        createSubtleCryptoProvider: vi.fn()
      };
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => 'failed_retryable'
    });

    const req = createMockRequest({});
    const response = await (Route.options.server!.handlers!.POST as any)({ request: req });
    
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason_code).toBe('RPC_REJECTED_RETRYABLE');
  });
});
