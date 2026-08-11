import { describe, it, expect, beforeEach } from 'vitest';
import { getCheckoutStatusImpl } from '../billing-status.server';

describe('getCheckoutStatusImpl strict validation', () => {
  const empresaId = 'f958365e-3951-46e6-8595-e4f111115a90';
  const CANONICAL_HOST = 'www.vejamais.com.br';
  const CANONICAL_ORIGIN = 'https://www.vejamais.com.br';
  const APEX_ORIGIN = 'https://vejamais.com.br';
  const PREVIEW_HOST = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
  const PREVIEW_ORIGIN = 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';

  beforeEach(() => {
    process.env['STRIPE_LIVE_BILLING_ENABLED'] = 'true';
  });

  it('should accept canonical www origin', async () => {
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, CANONICAL_ORIGIN);
    expect(result.checkout_enabled).toBe(true);
  });

  it('should accept apex origin', async () => {
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, APEX_ORIGIN);
    expect(result.checkout_enabled).toBe(true);
  });

  it('should reject non-https production origin', async () => {
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, 'http://www.vejamais.com.br');
    expect(result.checkout_enabled).toBe(false);
    expect(result.exact_disable_reason).toBe('Unauthorized origin');
  });

  it('should reject malicious subdomains', async () => {
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, 'https://evil.vejamais.com.br');
    expect(result.checkout_enabled).toBe(false);
  });

  it('should reject suffix attacks', async () => {
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, 'https://www.vejamais.com.br.evil.com');
    expect(result.checkout_enabled).toBe(false);
  });

  it('should reject null origin', async () => {
    const result = await getCheckoutStatusImpl(empresaId, CANONICAL_HOST, null);
    expect(result.checkout_enabled).toBe(false);
  });
});
