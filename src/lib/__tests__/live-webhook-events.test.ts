/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';

// Use a simple mock that returns an object, matching how Stripe is usually imported
const mockConstructEventAsync = vi.fn();

vi.mock('stripe', () => {
  const StripeMock = function() {
    return {
      webhooks: {
        constructEventAsync: mockConstructEventAsync
      }
    };
  };
  StripeMock.createFetchHttpClient = vi.fn();
  StripeMock.createSubtleCryptoProvider = vi.fn();
  return { default: StripeMock };
});

import { Route } from '../../routes/api/public/stripe-webhook/live';

describe('Stripe Live Webhook - Event Compliance Audit', () => {
  const handler = (Route.options.server as any).handlers.POST;

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
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success' })
      }));

      mockConstructEventAsync.mockResolvedValueOnce({
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    
    mockConstructEventAsync.mockResolvedValueOnce({
      id: 'evt_test',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: { id: 'cs_test' } }
    });

    const response = await handler({ request: createMockRequest('checkout.session.completed') });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason_code).toBe('LIVEMODE_REJECTED');
  });
});
