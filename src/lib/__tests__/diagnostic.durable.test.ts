import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';
import { resetDiagnostics } from "../../routes/api/public/stripe-webhook";
import { Route } from '../../routes/api/public/stripe-webhook';

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_DURABLE_DIAGNOSTICS_TARGETED_CORRECTION
 * Testes para validar o sistema de diagnóstico persistente.
 */

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

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockEnv = {
  STRIPE_RESTRICTED_KEY: 'rk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  VITE_SUPABASE_URL: 'https://bsrjtmssbnvttzrvnaab.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service_role_secret',
  STRIPE_PRICE_ENTERPRISE_MONTHLY: 'price_123',
  STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED: 'true'
};

describe('VEJAMAIS_STRIPE_DURABLE_DIAGNOSTICS_SUITE', () => {
  const getHandler = () => (Route.options.server as any).handlers.POST;
  
  const getMockConstructEventAsync = () => {
    const stripe = new Stripe('key');
    return stripe.webhooks.constructEventAsync as any;
  };

  beforeEach(() => {
    resetDiagnostics();
    vi.clearAllMocks();
    process.env = { ...process.env, ...mockEnv };
    // Reset global circuit breaker state if necessary, but it's a module level let.
    // In actual tests, the module persists. We can't easily reset it without re-importing.
    // For these tests, we assume a fresh start or we accept it might trigger.
  });

  const createRequest = (bodyText: string, signature: string | null = 'valid_sig') => {
    return {
      request: {
        headers: {
          get: (key: string) => (key === 'stripe-signature' ? signature : null),
        },
        text: async () => bodyText,
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

  it('TEST: SIGNATURE_VALIDATED checkpoint is the first persistent write', async () => {
    setupStripeEvent({ 
      id: 'evt_1', 
      type: 'checkout.session.completed', 
      livemode: false, 
      created: 123456, 
      data: { object: { id: 'cs_1', object: 'checkout.session', metadata: {} } } 
    });
    setupRpcResponse(200, { status: 'processed' });
    
    await getHandler()(createRequest('{}'));
    
    // Filtra chamadas para log_stripe_webhook_diagnostic
    const diagCalls = mockFetch.mock.calls.filter(call => call[0].includes('log_stripe_webhook_diagnostic'));
    
    expect(diagCalls.length).toBeGreaterThan(0);
    const firstDiagPayload = JSON.parse(diagCalls[0][1].body);
    expect(firstDiagPayload.p_stage).toBe('SIGNATURE_VALIDATED');
  });

  it('TEST: unsigned request does not write to diagnostics', async () => {
    const resp = await getHandler()(createRequest('{}', null));
    expect(resp.status).toBe(401);
    
    const diagCalls = mockFetch.mock.calls.filter(call => call[0].includes('log_stripe_webhook_diagnostic'));
    expect(diagCalls.length).toBe(0);
  });

  it('TEST: livemode=true does not write to diagnostics', async () => {
    setupStripeEvent({ 
      id: 'evt_live', 
      type: 'checkout.session.completed', 
      livemode: true, 
      created: 123456, 
      data: { object: { id: 'cs_live', metadata: {} } } 
    });
    
    const resp = await getHandler()(createRequest('{}'));
    expect(resp.status).toBe(400);
    
    const diagCalls = mockFetch.mock.calls.filter(call => call[0].includes('log_stripe_webhook_diagnostic'));
    expect(diagCalls.length).toBe(0);
  });

  it('TEST: maximum 5 persistent checkpoints', async () => {
    setupStripeEvent({ 
      id: 'evt_full', 
      type: 'checkout.session.completed', 
      livemode: false, 
      created: 123456, 
      data: { object: { id: 'cs_full', object: 'checkout.session', metadata: {} } } 
    });
    setupRpcResponse(200, { status: 'processed' });
    
    await getHandler()(createRequest('{}'));
    
    const diagCalls = mockFetch.mock.calls.filter(call => call[0].includes('log_stripe_webhook_diagnostic'));
    // SIGNATURE_VALIDATED, PAYLOAD_SANITIZED, RPC_CALL_STARTED, RPC_RESPONSE_RECEIVED, HTTP_RESPONSE_READY
    expect(diagCalls.length).toBe(5);
  });

  it('TEST: error_payload is absent from diagnostic payload', async () => {
    setupStripeEvent({ 
      id: 'evt_err', 
      type: 'checkout.session.completed', 
      livemode: false, 
      created: 123456, 
      data: { object: { id: 'cs_err', object: 'checkout.session', metadata: {} } } 
    });
    // RPC falha 500
    setupRpcResponse(500, { message: 'Database crash' });
    
    await getHandler()(createRequest('{}'));
    
    const diagCalls = mockFetch.mock.calls.filter(call => call[0].includes('log_stripe_webhook_diagnostic'));
    diagCalls.forEach(call => {
        const payload = JSON.parse(call[1].body);
        expect(payload).not.toHaveProperty('p_error_payload');
        expect(payload).not.toHaveProperty('p_stack_trace');
    });
  });

  it('TEST: circuit breaker stops further diagnostic calls after first failure', async () => {
    setupStripeEvent({ 
      id: 'evt_cb', 
      type: 'checkout.session.completed', 
      livemode: false, 
      created: 123456, 
      data: { object: { id: 'cs_cb', object: 'checkout.session', metadata: {} } } 
    });

    // Simular falha na primeira chamada diagnóstica
    mockFetch.mockImplementation((url) => {
        if (url.includes('log_stripe_webhook_diagnostic')) {
            return Promise.reject(new Error('Network failure'));
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ status: 'processed' }),
            text: async () => JSON.stringify({ status: 'processed' })
        });
    });

    await getHandler()(createRequest('{}'));

    const diagCalls = mockFetch.mock.calls.filter(call => call[0].includes('log_stripe_webhook_diagnostic'));
    // Deve ter tentado apenas uma vez e parado
    expect(diagCalls.length).toBe(1);
  });
});
