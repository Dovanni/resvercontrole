import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStripeCheckoutSessionImpl } from '../billing.server';
import { getRequest } from '@tanstack/react-start/server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(),
}));

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    rpc: vi.fn(),
  },
}));

vi.mock('../stripe.server', () => ({
  getStripeClient: vi.fn().mockReturnValue({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_live_new', url: 'https://stripe.com/pay', expires_at: 1723406400 }),
        retrieve: vi.fn()
      }
    }
  }),
}));

describe('VEJAMAIS_STRIPE_PRODUCTION_CHECKOUT_AUTHORITY_SUITE', () => {
  const empresaId = '550e8400-e29b-41d4-a716-446655440001';
  
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['STRIPE_LIVE_BILLING_ENABLED'] = 'true';
    process.env['STRIPE_RESTRICTED_KEY_LIVE'] = 'rk_live_123';
    process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE'] = 'price_live_enterprise';
    
    (supabaseAdmin.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    (supabaseAdmin.single as any).mockResolvedValue({ data: { role: 'admin', id: 'sub1', plans: { code: 'enterprise' } }, error: null });
    (supabaseAdmin.rpc as any).mockResolvedValue({ data: { id: 'att1', idempotency_key: 'i1', status: 'pending' }, error: null });
  });

  it('should ENABLE checkout on production domain when LIVE_BILLING is true', async () => {
    (getRequest as any).mockReturnValue({
      headers: {
        get: (key: string) => {
          if (key === 'Authorization') return 'Bearer token';
          if (key === 'host') return 'www.vejamais.com.br';
          if (key === 'origin') return 'https://www.vejamais.com.br';
          return null;
        }
      }
    });

    const result = await createStripeCheckoutSessionImpl(empresaId);
    expect(result.status).toBe('session_created');
  });

  it('should DISABLE checkout on unknown domain', async () => {
    (getRequest as any).mockReturnValue({
      headers: {
        get: (key: string) => {
          if (key === 'Authorization') return 'Bearer token';
          if (key === 'host') return 'unknown.domain';
          return null;
        }
      }
    });

    const result = await createStripeCheckoutSessionImpl(empresaId);
    expect(result.status).toBe('checkout_disabled');
  });
});
