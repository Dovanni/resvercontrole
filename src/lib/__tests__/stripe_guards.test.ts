import { describe, it, expect } from 'vitest';
import { validateCheckoutSessionContract } from '../stripe-guards.server';

describe('validateCheckoutSessionContract', () => {
  it('should accept valid checkout session', () => {
    const valid = { id: 'cs_test_123', object: 'checkout.session' };
    expect(validateCheckoutSessionContract(valid)).toBe(true);
  });

  it('should reject missing data', () => {
    expect(validateCheckoutSessionContract(null)).toBe(false);
    expect(validateCheckoutSessionContract(undefined)).toBe(false);
  });

  it('should reject non-object data', () => {
    expect(validateCheckoutSessionContract('string')).toBe(false);
    expect(validateCheckoutSessionContract(123)).toBe(false);
    expect(validateCheckoutSessionContract([])).toBe(false);
  });

  it('should reject missing id', () => {
    expect(validateCheckoutSessionContract({ object: 'checkout.session' })).toBe(false);
  });

  it('should reject invalid id prefix', () => {
    expect(validateCheckoutSessionContract({ id: 'evt_123', object: 'checkout.session' })).toBe(false);
  });

  it('should reject empty id', () => {
    expect(validateCheckoutSessionContract({ id: '', object: 'checkout.session' })).toBe(false);
  });

  it('should reject wrong object type', () => {
    expect(validateCheckoutSessionContract({ id: 'cs_test_123', object: 'event' })).toBe(false);
  });
});
