import { describe, it, expect, vi } from 'vitest';

// Mock Supabase
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { stripe_customer_id: 'cus_mock_123', status: 'active' },
            error: null
          })
        })
      })
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    }
  }
}));

// Mock Stripe
vi.mock('stripe', () => {
  class StripeMock {
    static createFetchHttpClient = vi.fn();
    billingPortal = {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/mock' })
      }
    };
  }
  return { default: StripeMock };
});

import { createStripePortalSessionImpl } from '../billing-portal.server';

describe('Stripe Customer Portal Logic', () => {
  it('should generate a portal URL for a valid customer', async () => {
    const result = await createStripePortalSessionImpl(
      '00000000-0000-4000-a000-000000000001',
      'https://vejamais.com.br',
      'vejamais.com.br'
    );
    
    expect(result.url).toBe('https://billing.stripe.com/mock');
  });
});
