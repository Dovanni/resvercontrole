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

const mockStripe = {
  checkout: {
    sessions: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
  },
};

// Ensure the real application code uses our mock instead of real Stripe SDK
vi.mock('@/lib/stripe.server', () => ({
  getStripeClient: vi.fn(() => mockStripe),
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
    
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'sess_1',
      url: 'https://checkout.stripe.com/pay/mock'
    });
  });

  const invokeHandler = (args: { data: { empresaId: string } }) => billingFunctions.createStripeCheckoutSessionHandler(args);

  describe('Group A: Entry and Identity', () => {
    it('should fail on missing JWT', async () => {
      mockHeaders.delete('authorization');
      await expect(invokeHandler({ data: { empresaId: mockEmpresaId } }))
        .rejects.toThrow('Unauthorized');
    });

    it('should fail on invalid JWT', async () => {
      mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid token') });
      await expect(invokeHandler({ data: { empresaId: mockEmpresaId } }))
        .rejects.toThrow('Unauthorized');
    });

    it('should fail if user is not admin', async () => {
      mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      mockSupabaseAdmin.single.mockResolvedValue({ data: { role: 'vendedor' }, error: null });
      await expect(invokeHandler({ data: { empresaId: mockEmpresaId } }))
        .rejects.toThrow('Forbidden: Admin access required');
    });

    it('should fail on cross-company attack (different empresa_id)', async () => {
       mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
       // simulate membership check failing because of eq(empresa_id)
       mockSupabaseAdmin.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
       await expect(invokeHandler({ data: { empresaId: mockEmpresaId } }))
         .rejects.toThrow('Forbidden: Admin access required');
    });
  });

  describe('Group B: Origin/Host Adversarial', () => {
    it('should fail on missing origin', async () => {
      mockHeaders.delete('origin');
      mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      mockSupabaseAdmin.single.mockResolvedValue({ data: { role: 'admin' }, error: null });
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on NULL origin', async () => {
      mockHeaders.set('origin', null);
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on HTTP origin', async () => {
      mockHeaders.set('origin', ALLOWED_ORIGIN.replace('https', 'http'));
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on port in origin', async () => {
      mockHeaders.set('origin', ALLOWED_ORIGIN + ':8080');
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on malicious prefix', async () => {
      mockHeaders.set('origin', 'https://malicious-' + ALLOWED_HOST);
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on origin suffix attack', async () => {
      mockHeaders.set('origin', ALLOWED_ORIGIN + '.malicious.com');
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on host mismatch with correct origin', async () => {
      mockHeaders.set('host', 'fake-host.com');
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail on forwarded-host spoofing', async () => {
      mockHeaders.set('x-forwarded-host', ALLOWED_HOST);
      mockHeaders.set('host', 'malicious-gateway.com');
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });
    
    it('should fail with correct origin but fake host', async () => {
      mockHeaders.set('origin', ALLOWED_ORIGIN);
      mockHeaders.set('host', 'evil.app');
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });

    it('should fail with correct host but fake origin', async () => {
      mockHeaders.set('origin', 'https://evil.app');
      mockHeaders.set('host', ALLOWED_HOST);
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.status).toBe('checkout_disabled');
    });
  });

  describe('Group C/D: Reservation and Quantity', () => {
    it('should evidence canonical quantity=1 in successful reservation', async () => {
      mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { role: 'admin' }, error: null }); 
      mockSupabaseAdmin.single.mockResolvedValueOnce({ 
        data: { id: 'sub_1', plan_id: 'p1', stripe_customer_id: 'c1', plans: { code: 'ent' } }, 
        error: null 
      });
      mockSupabaseAdmin.rpc.mockResolvedValue({ data: { id: 'att_1', idempotency_key: 'k1' }, error: null });
      
      const result = await invokeHandler({ data: { empresaId: mockEmpresaId } });
      expect(result.canonical_quantity).toBe(1);
      expect(result.item_count).toBe(1);
    });
  });
});
