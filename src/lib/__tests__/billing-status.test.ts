import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCheckoutStatus } from '../billing-status.functions';
import * as server from '@tanstack/react-start/server';

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(),
}));

describe('getCheckoutStatus', () => {
  const empresaId = 'f958365e-3951-46e6-8595-e4f111115a90';
  const CANONICAL_HOST = 'www.vejamais.com.br';
  const CANONICAL_ORIGIN = 'https://www.vejamais.com.br';
  const PREVIEW_HOST = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
  const PREVIEW_ORIGIN = 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';

  beforeEach(() => {
    vi.resetAllMocks();
    process.env['STRIPE_LIVE_BILLING_ENABLED'] = 'false';
  });

  it('should be disabled in production when flag is false', async () => {
    (server.getRequest as any).mockReturnValue({
      headers: new Headers({
        'host': CANONICAL_HOST,
        'origin': CANONICAL_ORIGIN,
      }),
    });

    const result = await getCheckoutStatus({ data: { empresaId } });
    expect(result.checkout_enabled).toBe(false);
    expect(result.billing_environment).toBe('live');
    expect(result.exact_disable_reason).toBe('Production checkout disabled');
  });

  it('should be enabled in production when flag is true', async () => {
    process.env['STRIPE_LIVE_BILLING_ENABLED'] = 'true';
    (server.getRequest as any).mockReturnValue({
      headers: new Headers({
        'host': CANONICAL_HOST,
        'origin': CANONICAL_ORIGIN,
      }),
    });

    const result = await getCheckoutStatus({ data: { empresaId } });
    expect(result.checkout_enabled).toBe(true);
    expect(result.billing_environment).toBe('live');
  });

  it('should be enabled in preview regardless of flag', async () => {
    (server.getRequest as any).mockReturnValue({
      headers: new Headers({
        'host': PREVIEW_HOST,
        'origin': PREVIEW_ORIGIN,
      }),
    });

    const result = await getCheckoutStatus({ data: { empresaId } });
    expect(result.checkout_enabled).toBe(true);
    expect(result.billing_environment).toBe('sandbox');
  });

  it('should be disabled for unauthorized host', async () => {
    (server.getRequest as any).mockReturnValue({
      headers: new Headers({
        'host': 'malicious.com',
        'origin': 'https://malicious.com',
      }),
    });

    const result = await getCheckoutStatus({ data: { empresaId } });
    expect(result.checkout_enabled).toBe(false);
    expect(result.exact_disable_reason).toBe('Unauthorized origin');
  });
});
