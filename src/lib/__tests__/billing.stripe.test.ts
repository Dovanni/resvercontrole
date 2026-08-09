import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStripeCheckoutSession } from '../billing.functions';

// Mocking server environment and supabaseAdmin
const mockSupabaseAdmin = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => ({
    headers: {
      get: vi.fn((key) => {
        const headers: Record<string, string> = {
          'Authorization': 'Bearer mock-token',
          'host': 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app',
          'origin': 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app'
        };
        return headers[key.toLowerCase()];
      })
    }
  })),
}));

describe('createStripeCheckoutSession - Quantity and Security', () => {
  const mockEmpresaId = '00000000-0000-0000-0000-000000000000';
  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['STRIPE_RESTRICTED_KEY'] = 'rk_test_mock';
    process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] = 'price_mock';
  });

  it('should reserve attempt with canonical quantity=1 evidence', async () => {
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } } });
    
    // Mock membership check
    mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
    
    // Mock subscription lookup
    mockSupabaseAdmin.single.mockResolvedValueOnce({ 
      data: { id: 'sub_123', plan_id: 'plan_123', stripe_customer_id: 'cus_123' }, 
      error: null 
    });

    // Mock RPC reservation
    mockSupabaseAdmin.rpc.mockResolvedValue({ 
      data: { id: 'att_123', idempotency_key: 'key_123' }, 
      error: null 
    });

    const result = await createStripeCheckoutSession({ data: { empresaId: mockEmpresaId } });

    expect(result.status).toBe('ready_for_authorization');
    expect(result.canonical_quantity).toBe(1);
    expect(result.item_count).toBe(1);
    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('reserve_checkout_attempt', expect.objectContaining({
      p_verified_user_id: mockUserId
    }));
  });

  it('should fail if user is not admin', async () => {
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } } });
    mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'vendedor' }, error: null });

    await expect(createStripeCheckoutSession({ data: { empresaId: mockEmpresaId } }))
      .rejects.toThrow('Forbidden: Admin access required');
  });

  it('should fail if host is unauthorized', async () => {
    const { getRequest } = await import('@tanstack/react-start/server');
    (getRequest as any).mockReturnValue({
      headers: {
        get: vi.fn((key) => (key.toLowerCase() === 'host' ? 'malicious-site.com' : 'Bearer mock-token'))
      }
    });

    mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } } });
    mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });

    const result = await createStripeCheckoutSession({ data: { empresaId: mockEmpresaId } });
    expect(result.status).toBe('checkout_disabled');
  });
});
