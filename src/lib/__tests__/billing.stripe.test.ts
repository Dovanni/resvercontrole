import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Definição do Mock da supabaseAdmin
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

// 2. Mocking dos módulos
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

const mockHeaders = new Map();
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => ({
    headers: {
      get: vi.fn((key) => mockHeaders.get(key.toLowerCase()))
    }
  })),
}));

// 3. Import do código REAL
import * as billingFunctions from '../billing.functions';

describe('createStripeCheckoutSession - Security Corrective Suite', () => {
  const mockEmpresaId = '00000000-0000-0000-0000-000000000000';
  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const ALLOWED_HOST = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
  const ALLOWED_ORIGIN = 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.clear();
    mockHeaders.set('authorization', 'Bearer mock-token');
    mockHeaders.set('host', ALLOWED_HOST);
    mockHeaders.set('origin', ALLOWED_ORIGIN);
    process.env['STRIPE_RESTRICTED_KEY'] = 'rk_test_mock';
    process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] = 'price_mock';
  });

  const invokeHandler = (args: any) => billingFunctions.createStripeCheckoutSessionHandler(args);

  describe('Group B: Origin/Host Adversarial', () => {
    it('should fail on missing origin', async () => {
      mockHeaders.delete('origin');
      mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      mockSupabaseAdmin.single.mockResolvedValue({ data: { role: 'admin' }, error: null });
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on HTTP origin', async () => {
      mockHeaders.set('origin', ALLOWED_ORIGIN.replace('https', 'http'));
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on host mismatch with correct origin', async () => {
      mockHeaders.set('host', 'fake-host.com');
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on origin suffix attack', async () => {
      mockHeaders.set('origin', ALLOWED_ORIGIN + '.malicious.com');
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });
  });

  describe('Group A/D: Identity and Quantity', () => {
    it('should fail if user is not admin', async () => {
      mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      mockSupabaseAdmin.single.mockResolvedValue({ data: { role: 'user' }, error: null });
      await expect(invokeHandler({ data: { empresaId: mockEmpresaId } }))
        .rejects.toThrow('Forbidden: Admin access required');
    });

    it('should evidence canonical quantity=1 in successful reservation', async () => {
      mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null }); // Access check
      mockSupabaseAdmin.single.mockResolvedValueOnce({ 
        data: { id: 'sub_1', plan_id: 'p1', stripe_customer_id: 'c1', plans: { code: 'ent' } }, 
        error: null 
      }); // Sub check
      mockSupabaseAdmin.rpc.mockResolvedValue({ data: { id: 'att_1', idempotency_key: 'k1' }, error: null });
      
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.canonical_quantity).toBe(1);
    });
  });
});
