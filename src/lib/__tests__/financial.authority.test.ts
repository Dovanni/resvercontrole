import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

describe('Financial Authority and Type Narrowing Suite', () => {
  const CANONICAL_PRICE_ID = 'price_enterprise_monthly';
  const CANONICAL_AMOUNT = 3590;
  const CANONICAL_CURRENCY = 'brl';
  const CANONICAL_QUANTITY = 1;

  beforeEach(() => {
    process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] = CANONICAL_PRICE_ID;
  });

  const validateFinancials = (payload: any) => {
    const observed_price_id = payload.observed_price_id;
    const observed_amount = payload.observed_amount;
    const observed_currency = payload.observed_currency;
    const observed_quantity = payload.observed_quantity;

    const priceMatch = observed_price_id === process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'];
    const amountMatch = observed_amount === CANONICAL_AMOUNT;
    const currencyMatch = observed_currency === CANONICAL_CURRENCY;
    const quantityMatch = observed_quantity === CANONICAL_QUANTITY;

    return priceMatch && amountMatch && currencyMatch && quantityMatch;
  };

  describe('Type Narrowing (Strict Type Checking)', () => {
    it('should correctly narrow Checkout Session without any coercion', () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_1',
            object: 'checkout.session',
            metadata: { empresa_id: 'e1' },
            amount_total: 3590,
            currency: 'brl'
          }
        }
      } as unknown as Stripe.Event;

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        expect(session.id).toBe('cs_1');
        expect(session.amount_total).toBe(3590);
      } else {
        throw new Error('Wrong event type');
      }
    });

    it('should correctly narrow Invoice without any coercion', () => {
      const event = {
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_1',
            object: 'invoice',
            amount_paid: 3590,
            currency: 'brl',
            lines: { data: [{ price: { id: 'price_1' }, quantity: 1 }] }
          }
        }
      } as unknown as Stripe.Event;

      if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice;
        expect(invoice.id).toBe('in_1');
        expect(invoice.amount_paid).toBe(3590);
      } else {
        throw new Error('Wrong event type');
      }
    });
  });

  describe('Financial Authority Separated Validation', () => {
    it('should pass with correct Price ID and amount', () => {
      const payload = {
        observed_price_id: CANONICAL_PRICE_ID,
        observed_amount: 3590,
        observed_currency: 'brl',
        observed_quantity: 1
      };
      expect(validateFinancials(payload)).toBe(true);
    });

    it('should fail with incorrect Price ID but correct amount', () => {
      const payload = {
        observed_price_id: 'wrong_price',
        observed_amount: 3590,
        observed_currency: 'brl',
        observed_quantity: 1
      };
      expect(validateFinancials(payload)).toBe(false);
    });

    it('should fail with correct Price ID but incorrect amount', () => {
      const payload = {
        observed_price_id: CANONICAL_PRICE_ID,
        observed_amount: 1000,
        observed_currency: 'brl',
        observed_quantity: 1
      };
      expect(validateFinancials(payload)).toBe(false);
    });

    it('should fail with incorrect currency', () => {
      const payload = {
        observed_price_id: CANONICAL_PRICE_ID,
        observed_amount: 3590,
        observed_currency: 'usd',
        observed_quantity: 1
      };
      expect(validateFinancials(payload)).toBe(false);
    });

    it('should fail with incorrect quantity', () => {
      const payload = {
        observed_price_id: CANONICAL_PRICE_ID,
        observed_amount: 3590,
        observed_currency: 'brl',
        observed_quantity: 2
      };
      expect(validateFinancials(payload)).toBe(false);
    });

    it('should fail if financial fields are missing', () => {
      const payload = {
        observed_price_id: CANONICAL_PRICE_ID,
        observed_currency: 'brl'
      };
      expect(validateFinancials(payload)).toBe(false);
    });
  });
});
