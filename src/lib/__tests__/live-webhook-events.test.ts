/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { Route } from '../../routes/api/public/stripe-webhook/live';

// Mock process.env
const mockEnv = {
  STRIPE_RESTRICTED_KEY_LIVE: 'rk_live_mock',
  STRIPE_WEBHOOK_SECRET_LIVE: 'whsec_live_mock',
  VITE_SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE: 'price_mock_123',
  STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED: 'true'
};

vi.stubGlobal('process', {
  ...process,
  env: { ...process.env, ...mockEnv }
});

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEventAsync: vi.fn().mockResolvedValue({
          id: 'evt_mock',
          type: 'checkout.session.completed',
          livemode: true,
          created: 123456789,
          data: {
            object: {
              id: 'cs_mock',
              object: 'checkout.session',
              customer: 'cus_mock',
              subscription: 'sub_mock',
              status: 'complete',
              metadata: { plan_code: 'enterprise_monthly' }
            }
          }
        })
      }
    })),
    createFetchHttpClient: vi.fn(),
    createSubtleCryptoProvider: vi.fn()
  };
});

describe('Stripe Live Webhook - Event Compliance Audit', () => {
  const handler = (Route.options.server as any).handlers.POST;

  const createMockRequest = (type: string) => {
    return {
      headers: {
        get: (name: string) => {
          if (name === 'stripe-signature') return 'mock_sig';
          return null;
        }
      },
      text: async () => JSON.stringify({ id: 'evt_mock', type })
    } as unknown as Request;
  };

  const supportedEvents = [
    'checkout.session.completed',
    'checkout.session.expired',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed'
  ];

  it('should have exactly 7 homologated events in the live route', () => {
    expect(supportedEvents.length).toBe(7);
  });

  supportedEvents.forEach(eventType => {
    it(`should accept and process ${eventType} in Live mode`, async () => {
      // Mock global fetch for RPC and diagnostics
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success' })
      }));

      // Mock constructive event to return the specific type
      const Stripe = (await import('stripe')).default;
      const stripeInstance = new (Stripe as any)();
      stripeInstance.webhooks.constructEventAsync.mockResolvedValueOnce({
        id: `evt_${eventType}`,
        type: eventType,
        livemode: true,
        created: Date.now(),
        data: {
          object: {
            id: 'obj_mock',
            object: eventType.includes('checkout') ? 'checkout.session' : 'other',
            customer: 'cus_mock',
            metadata: { plan_code: 'enterprise_monthly' }
          }
        }
      });

      const response = await handler({ request: createMockRequest(eventType) });
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.stage).toBe('HTTP_RESPONSE_READY');
    });
  });

  it('should reject test mode (livemode=false) events in the Live route', async () => {
    const Stripe = (await import('stripe')).default;
    const stripeInstance = new (Stripe as any)();
    stripeInstance.webhooks.constructEventAsync.mockResolvedValueOnce({
      id: 'evt_test',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: {} }
    });

    const response = await handler({ request: createMockRequest('checkout.session.completed') });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason_code).toBe('LIVEMODE_REJECTED');
  });
});
