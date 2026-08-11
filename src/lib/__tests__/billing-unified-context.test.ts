import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { getCompanySubscriptionContextImpl } from '../billing.server';
import { getCheckoutStatusImpl } from '../billing-status.server';

// Mock TanStack Start getRequest
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => ({
    headers: new Map([
      ['Authorization', 'Bearer mock-token'],
      ['host', 'www.vejamais.com.br'],
      ['origin', 'https://www.vejamais.com.br']
    ])
  }))
}));

// Mock Supabase Admin
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Billing Unified Context Unified Test Suite', () => {
  const mockEmpresaId = 'f958365e-3951-46e6-8595-e4f111115a90';
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return complete context for authorized user (Production + Trialing)', async () => {
    // 1. Mock Auth
    (supabaseAdmin.auth.getUser as any).mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null
    });

    // 2. Mock Subscription Context RPC
    (supabaseAdmin.rpc as any).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_company_subscription_context_admin') {
        return Promise.resolve({
          data: {
            plan_code: 'essencial',
            plan_name: 'Plano Essencial',
            status: 'trialing',
            days_remaining: 26,
            current_period_ends_at: '2026-09-01T00:00:00Z',
            current_user_count: 2,
            trial_ends_at: '2026-09-01T00:00:00Z'
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Force environment for test
    process.env.STRIPE_LIVE_BILLING_ENABLED = 'false';
    
    // Execute implementations
    const subContext = await getCompanySubscriptionContextImpl(mockEmpresaId);
    const checkoutStatus = await getCheckoutStatusImpl(mockEmpresaId, 'www.vejamais.com.br', 'https://www.vejamais.com.br');

    // Assertions
    expect(subContext).toBeDefined();
    expect(subContext?.status).toBe('trialing');
    expect(subContext?.days_remaining).toBe(26);
    expect(checkoutStatus.billing_environment).toBe('live');

    
    // Simulate LIVE environment enabled
    process.env.STRIPE_LIVE_BILLING_ENABLED = 'true';
    const checkoutStatusLive = await getCheckoutStatusImpl(mockEmpresaId, 'www.vejamais.com.br', 'https://www.vejamais.com.br');
    expect(checkoutStatusLive.billing_environment).toBe('live');
    expect(checkoutStatusLive.checkout_enabled).toBe(true);
  });


  it('should return sandbox for preview host', async () => {
    const previewHost = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
    const checkoutStatus = await getCheckoutStatusImpl(mockEmpresaId, previewHost, `https://${previewHost}`);
    
    expect(checkoutStatus.billing_environment).toBe('sandbox');
    expect(checkoutStatus.checkout_enabled).toBe(true);
  });

  it('should deny access for cross-company users', async () => {
    // This logic is implemented in the Route handler, but we can verify the primitives here
    // Membership check is in the route context, but subscription context also checks it via RPC
    
    (supabaseAdmin.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'wrong-user' } },
      error: null
    });

    (supabaseAdmin.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Access denied' }
    });

    await expect(getCompanySubscriptionContextImpl(mockEmpresaId)).rejects.toThrow('Failed to fetch subscription context');
  });
});
