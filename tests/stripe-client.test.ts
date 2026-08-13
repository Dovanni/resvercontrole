import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStripeClient } from '../src/lib/stripe.server';

describe('getStripeClient Security Gate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('accepts rk_live_ in live mode', () => {
    process.env.STRIPE_RESTRICTED_KEY = 'rk_live_mock_key_123';
    const client = getStripeClient(true);
    expect(client).toBeDefined();
    // Use any as apiKey is private in Stripe SDK
    expect((client as any).apiKey).toBe('rk_live_mock_key_123');
  });

  it('rejects rk_live_ in sandbox mode', () => {
    process.env.STRIPE_RESTRICTED_KEY = 'rk_live_mock_key_123';
    expect(() => getStripeClient(false)).toThrow(/Attempting test\/sandbox checkout with live key/);
    try {
      getStripeClient(false);
    } catch (e: any) {
      expect(e.__isStripeClientError).toBe(true);
      expect(e.reason_code).toBe('STRIPE_CLIENT_KEY_MODE_MISMATCH');
    }
  });

  it('rejects test key in live mode', () => {
    process.env.STRIPE_RESTRICTED_KEY = 'rk_test_mock_key_123';
    expect(() => getStripeClient(true)).toThrow(/Attempting live checkout with non-live key/);
    try {
      getStripeClient(true);
    } catch (e: any) {
      expect(e.__isStripeClientError).toBe(true);
      expect(e.reason_code).toBe('STRIPE_CLIENT_KEY_MODE_MISMATCH');
    }
  });

  it('rejects missing key', () => {
    process.env.STRIPE_RESTRICTED_KEY = '';
    expect(() => getStripeClient(true)).toThrow(/Stripe key is missing/);
    try {
      getStripeClient(true);
    } catch (e: any) {
      expect(e.reason_code).toBe('STRIPE_CLIENT_KEY_MISSING');
    }
  });

  it('rejects malformed key', () => {
    process.env.STRIPE_RESTRICTED_KEY = 'invalid_prefix_123';
    expect(() => getStripeClient(true)).toThrow(/Invalid Stripe key format/);
    try {
      getStripeClient(true);
    } catch (e: any) {
      expect(e.reason_code).toBe('STRIPE_CLIENT_KEY_FORMAT_INVALID');
    }
  });
});
