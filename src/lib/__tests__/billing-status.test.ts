import { describe, it, expect, beforeEach } from 'vitest';
import { getCheckoutStatusImpl } from '../billing-status.server';

describe('getCheckoutStatusImpl', () => {
  const empresaId = 'f958365e-3951-46e6-8595-e4f111115a90';
  const CANONICAL_HOST = 'www.vejamais.com.br';
  const CANONICAL_ORIGIN = 'https://www.vejamais.com.br';
  const PREVIEW_HOST = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
  const PREVIEW_ORIGIN = 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';

  beforeEach(() => {
    process.env['STRIPE_LIVE_BILLING_ENABLED'] = 'false';
  });

  it('should be disabled in production when flag is false', async () => {
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, CANONICAL_ORIGIN);
    expect(result.checkout_enabled).toBe(false);
    expect(result.billing_environment).toBe('live');
    expect(result.exact_disable_reason).toBe('Production checkout disabled');
  });

  it('should be enabled in production when flag is true', async () => {
    process.env['STRIPE_LIVE_BILLING_ENABLED'] = 'true';
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, CANONICAL_ORIGIN);
    expect(result.checkout_enabled).toBe(true);
    expect(result.billing_environment).toBe('live');
  });

  it('should be enabled in preview regardless of flag', async () => {
    const result = await getCheckoutStatusImpl(empresaId, PREVIEW_HOST, PREVIEW_ORIGIN);
    expect(result.checkout_enabled).toBe(true);
    expect(result.billing_environment).toBe('sandbox');
  });

  it('should be disabled for unauthorized host', async () => {
    const result = await getCheckoutStatusImpl(empresaId, 'malicious.com', 'https://malicious.com');
    expect(result.checkout_enabled).toBe(false);
    expect(result.exact_disable_reason).toBe('Unauthorized origin');
  });
});
