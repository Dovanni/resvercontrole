import { describe, it, expect, vi } from 'vitest';

// Mock values
const mockEmpresaId = '00000000-0000-4000-a000-000000000001';
const mockCustomerId = 'cus_mock_123';

// Mock Supabase
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { stripe_customer_id: 'cus_mock_123', status: 'active' },
      error: null
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    }
  }
}));

// Mock Stripe
vi.mock('stripe', () => {
  const StripeMock = vi.fn().mockImplementation(() => ({
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/mock' })
      }
    }
  }));
  (StripeMock as any).createFetchHttpClient = vi.fn();
  return { default: StripeMock };
});

import { createStripePortalSessionImpl } from '../billing-portal.server';

describe('Stripe Customer Portal Logic', () => {
  it('should generate a portal URL for a valid customer', async () => {
    const result = await createStripePortalSessionImpl(
      mockEmpresaId,
      'https://vejamais.com.br',
      'vejamais.com.br'
    );
    
    expect(result.url).toBe('https://billing.stripe.com/mock');
  });

  it('should fail if company has no stripe_customer_id', async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    (supabaseAdmin.single as any).mockResolvedValueOnce({ data: null, error: null });

    await expect(createStripePortalSessionImpl(
      mockEmpresaId,
      'https://vejamais.com.br',
      'vejamais.com.br'
    )).rejects.toThrow('CUSTOMER_NOT_FOUND');
  });
});
