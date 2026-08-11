import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';
import { Route } from '../../routes/api/public/stripe-webhook';

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_DIAGNOSTIC_EXPIRED_EVENT_REPRODUCTION
 * Objetivo: Reproduzir e testar o comportamento do handler para checkout.session.expired
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
};

describe('VEJAMAIS_STRIPE_EXPIRED_EVENT_DIAGNOSTIC_SUITE', () => {
  const mockUuid = '550e8400-e29b-41d4-a716-446655440000';
  const getHandler = () => (Route.options.server as any).handlers.POST;
  
  const getMockConstructEventAsync = () => {
    const stripe = new Stripe('key');
    return stripe.webhooks.constructEventAsync as any;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...process.env, ...mockEnv };
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

  it('DIAG-1: checkout.session.expired successfully processed', async () => {
    setupStripeEvent({ 
      id: 'evt_exp_1', 
      type: 'checkout.session.expired', 
      livemode: false, 
      created: 123456, 
      data: { 
        object: { 
          id: 'cs_test_expired', 
          object: 'checkout.session',


          customer: 'cus_123',
          subscription: null,
          status: 'expired',
          metadata: { plan_code: 'enterprise_monthly' } 
        } 
      } 
    });
    setupRpcResponse(200, { status: 'processed' });
    
    const resp = await getHandler()(createRequest('{}'));
    const body = await resp.json();
    
    expect(resp.status).toBe(200);
    // O Fast Path usa HTTP_RESPONSE_CREATED em vez de HTTP_RESPONSE_READY
    expect(body.stage).toBe('HTTP_RESPONSE_CREATED');
    
    // Verificar se o payload enviado à RPC está correto
    const fetchArgs = mockFetch.mock.calls[0];
    const rpcPayload = JSON.parse(fetchArgs[1].body);
    expect(rpcPayload.p_event_type).toBe('checkout.session.expired');
    expect(rpcPayload.p_event_data.id).toBe('cs_test_expired');
  });

  it('DIAG-2: checkout.session.expired with RPC failure (500)', async () => {
    setupStripeEvent({ 
      id: 'evt_exp_2', 
      type: 'checkout.session.expired', 
      livemode: false, 
      created: 123457, 
      data: { 
        object: { 
          id: 'cs_test_expired_fail', 
          object: 'checkout.session',


          customer: 'cus_123',
          subscription: null,
          status: 'expired',
          metadata: {} 
        } 
      } 
    });
    // Simular falha 500 na RPC
    setupRpcResponse(500, { error: 'Internal Database Error during expiration handling' });
    
    const resp = await getHandler()(createRequest('{}'));
    const body = await resp.json();
    
    expect(resp.status).toBe(503);
    expect(body.reason_code).toBe('RPC_TRANSPORT_RETRYABLE');
  });

  it('DIAG-3: checkout.session.expired with missing RPC credentials', async () => {
    setupStripeEvent({ 
      id: 'evt_exp_3', 
      type: 'checkout.session.expired', 
      livemode: false, 
      created: 123458, 
      data: { object: { id: 'cs_test_1', object: 'checkout.session', metadata: {} } } 
    });
    
    // Remover env var essencial
    delete process.env.VITE_SUPABASE_URL;
    
    const resp = await getHandler()(createRequest('{}'));
    const body = await resp.json();
    
    expect(resp.status).toBe(500);
    expect(body.reason_code).toBe('SERVER_CONFIGURATION_MISSING');
  });
});