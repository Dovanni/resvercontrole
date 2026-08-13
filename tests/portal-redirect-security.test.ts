import { describe, it, expect, vi } from 'vitest';

describe('Portal Redirect Security Logic', () => {
  it('should validate Stripe billing host and https protocol', () => {
    const validate = (urlStr: string) => {
      try {
        const url = new URL(urlStr);
        return url.protocol === "https:" && url.hostname === "billing.stripe.com";
      } catch {
        return false;
      }
    };

    expect(validate('https://billing.stripe.com/session/123')).toBe(true);
    expect(validate('http://billing.stripe.com/session/123')).toBe(false);
    expect(validate('https://malicious-site.com/billing.stripe.com')).toBe(false);
    expect(validate('javascript:alert(1)')).toBe(false);
  });
});
