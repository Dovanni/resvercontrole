import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';
import { Route as LiveRoute } from '../../routes/api/public/stripe-webhook/live';

vi.mock('stripe', () => {
  const mockConstructEventAsync = vi.fn();
  const mockStripeInstance = {
    webhooks: {
      constructEventAsync: mockConstructEventAsync,
    },
  };
  const StripeMock = function(this: any) { return mockStripeInstance; } as any;
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

describe('VEJAMAIS_STRIPE_LIVE_WEBHOOK_SEPARATION_SUITE', () => {
  const getHandler = () => (LiveRoute.options.server as any).handlers.POST;
  
  const setupStripeEvent = (event: any) => {
    const stripe = new Stripe('key');
    (stripe.webhooks.constructEventAsync as any).mockResolvedValue(event);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...process.env,
      STRIPE_RESTRICTED_KEY_LIVE: 'rk_live_123',
      STRIPE_WEBHOOK_SECRET_LIVE: 'whsec_live_123',
      STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE: 'price_live_enterprise',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
      STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED: 'false'
    };
  });

  const createRequest = (signature: string | null = 'valid_sig') => ({
    request: {
      headers: { get: (key: string) => (key === 'stripe-signature' ? signature : null) },
      text: async () => '{}',
    },
  } as any);

  it('should REJECT livemode=false on Live route', async () => {
    setupStripeEvent({ id: 'evt_1', type: 'checkout.session.completed', livemode: false });
    const resp = await getHandler()(createRequest());
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.reason_code).toBe('LIVEMODE_REJECTED');
  });

  it('should ACCEPT livemode=true on Live route', async () => {
    setupStripeEvent({ 
      id: 'evt_2', 
      type: 'checkout.session.completed', 
      livemode: true,
      data: { object: { id: 'cs_live_1', object: 'checkout.session', metadata: {} } }
    });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'processed' }) });
    
    const resp = await getHandler()(createRequest());
    expect(resp.status).toBe(200);
  });
});
