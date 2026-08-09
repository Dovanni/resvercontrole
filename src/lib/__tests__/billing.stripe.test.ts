import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStripeCheckoutSession } from '../billing.functions';
import * as serverClient from '../../integrations/supabase/client.server';

// Mocking server environment and supabaseAdmin
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
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
  },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => ({
    headers: new Map([
      ['Authorization', 'Bearer mock-token'],
      ['host', 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app'],
      ['origin', 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app'],
    ]),
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
    const admin = serverClient.supabaseAdmin;
    (admin.auth.getUser as any).mockResolvedValue({ data: { user: { id: mockUserId } } });
    
    // Mock membership check
    (admin.single as any).mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
    
    // Mock subscription lookup
    (admin.single as any).mockResolvedValueOnce({ 
      data: { id: 'sub_123', plan_id: 'plan_123', stripe_customer_id: 'cus_123' }, 
      error: null 
    });

    // Mock RPC reservation
    (admin.rpc as any).mockResolvedValue({ 
      data: { id: 'att_123', idempotency_key: 'key_123' }, 
      error: null 
    });

    const result = await createStripeCheckoutSession({ data: { empresaId: mockEmpresaId } });

    expect(result.status).toBe('ready_for_authorization');
    expect(result.canonical_quantity).toBe(1);
    expect(result.item_count).toBe(1);
    expect(admin.rpc).toHaveBeenCalledWith('reserve_checkout_attempt', expect.objectContaining({
      p_verified_user_id: mockUserId
    }));
  });

  it('should fail if user is not admin', async () => {
    const admin = serverClient.supabaseAdmin;
    (admin.auth.getUser as any).mockResolvedValue({ data: { user: { id: mockUserId } } });
    (admin.single as any).mockResolvedValueOnce({ data: { role: 'vendedor' }, error: null });

    await expect(createStripeCheckoutSession({ data: { empresaId: mockEmpresaId } }))
      .rejects.toThrow('Forbidden: Admin access required');
  });

  it('should fail if host is unauthorized', async () => {
    const { getRequest } = await import('@tanstack/react-start/server');
    (getRequest as any).mockReturnValue({
      headers: new Map([
        ['Authorization', 'Bearer mock-token'],
        ['host', 'malicious-site.com'],
      ]),
    });

    const admin = serverClient.supabaseAdmin;
    (admin.auth.getUser as any).mockResolvedValue({ data: { user: { id: mockUserId } } });
    (admin.single as any).mockResolvedValueOnce({ data: { role: 'admin' }, error: null });

    const result = await createStripeCheckoutSession({ data: { empresaId: mockEmpresaId } });
    expect(result.status).toBe('checkout_disabled');
  });
});
