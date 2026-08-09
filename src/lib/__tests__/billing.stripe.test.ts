import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Definição do Mock da supabaseAdmin (feita ANTES do import do código real)
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

// 2. Mocking dos módulos @/integrations/supabase/client.server
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

// 3. Mocking do @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => ({
    headers: {
      get: vi.fn((key) => {
        const k = key.toLowerCase();
        if (k === 'authorization') return 'Bearer mock-token';
        if (k === 'host') return 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
        if (k === 'origin') return 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
        return null;
      })
    }
  })),
}));

// 4. Import do código REAL (o handler da server function)
import * as billingFunctions from '../billing.functions';

describe('createStripeCheckoutSession - Quantity and Security', () => {
  const mockEmpresaId = '00000000-0000-0000-0000-000000000000';
  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['STRIPE_RESTRICTED_KEY'] = 'rk_test_mock';
    process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] = 'price_mock';
  });

  // Helper para invocar o handler diretamente
  const invokeHandler = (args: any) => billingFunctions.createStripeCheckoutSessionHandler(args);

  it('should reserve attempt with canonical quantity=1 evidence', async () => {
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });
    mockSupabaseAdmin.single.mockResolvedValueOnce({ 
      data: { id: 'sub_123', plan_id: 'plan_123', stripe_customer_id: 'cus_123', plans: { code: 'enterprise_monthly' } }, 
      error: null 
    });
    mockSupabaseAdmin.rpc.mockResolvedValue({ 
      data: { id: 'att_123', idempotency_key: 'key_123' }, 
      error: null 
    });

    const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });

    expect(result.status).toBe('ready_for_authorization');
    expect(result.canonical_quantity).toBe(1);
    expect(result.item_count).toBe(1);
  });

  it('should fail if user is not admin', async () => {
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'vendedor' }, error: null });

    await expect(invokeHandler({ data: { empresaId: mockEmpresaId } }))
      .rejects.toThrow('Forbidden: Admin access required');
  });

  it('should fail if host is unauthorized', async () => {
    const { getRequest } = await import('@tanstack/react-start/server');
    (getRequest as any).mockReturnValue({
      headers: {
        get: vi.fn((key) => (key.toLowerCase() === 'host' ? 'malicious-site.com' : 'Bearer mock-token'))
      }
    });

    mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });

    const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
    expect(result.status).toBe('checkout_disabled');
  });
});
