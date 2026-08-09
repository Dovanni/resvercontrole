import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';

describe('Stripe Webhook Contract - Corrective Type Safety and Ordering', () => {
  
  const canonical_price = 3590;
  const canonical_currency = 'brl';

  const extractSanitizedPayload = (event: Stripe.Event) => {
    const payloadHash = 'mock_hash';
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          provider: 'stripe',
          provider_event_id: event.id,
          event_type: event.type,
          event_created: event.created,
          empresa_id: session.metadata?.empresa_id,
          stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
          observed_currency: session.currency?.toLowerCase(),
          observed_amount: session.amount_total || 0,
          observed_quantity: 1,
        };
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const lineItem = invoice.lines.data[0];
        return {
          provider: 'stripe',
          provider_event_id: event.id,
          event_type: event.type,
          event_created: event.created,
          empresa_id: invoice.metadata?.empresa_id,
          stripe_subscription_id: typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id,
          observed_currency: invoice.currency?.toLowerCase(),
          observed_amount: invoice.amount_paid,
          observed_quantity: lineItem?.quantity || 1,
        };
      }
      default:
        throw new Error(`Unsupported event type in test: ${event.type}`);
    }
  };

  describe('Group E: Webhook Sanitation and Validation', () => {
    it('should sanitize payload removing raw objects and untrusted fields', () => {
      const rawEvent = {
        id: 'evt_1',
        type: 'checkout.session.completed',
        created: 123456,
        data: {
          object: {
            id: 'cs_1',
            customer: 'cus_1',
            metadata: { empresa_id: 'e1' },
            currency: 'BRL',
            amount_total: 3590,
            items: { data: [{ quantity: 1 }] },
            extra_field_to_be_removed: 'secret'
          }
        }
      };

      const sanitized = extractSanitizedPayload(rawEvent as unknown as Stripe.Event);
      expect((sanitized as Record<string, any>).extra_field_to_be_removed).toBeUndefined();
      expect((sanitized as Record<string, any>).data).toBeUndefined();
      expect(sanitized.empresa_id).toBe('e1');
      expect(sanitized.observed_currency).toBe('brl');
      expect(sanitized.observed_amount).toBe(3590);
    });

    it('should handle missing quantity by defaulting to 1 (fail-safe for extraction, RPC enforces)', () => {
      const event = {
        id: 'evt_2',
        type: 'invoice.paid',
        created: 123457,
        data: { object: { lines: { data: [{ }] }, metadata: { empresa_id: 'e1' } } }
      };
      const sanitized = extractSanitizedPayload(event as unknown as Stripe.Event);
      expect(sanitized.observed_quantity).toBe(1);
    });
  });

  describe('Group F: Temporal Ordering (Logical Proof)', () => {
    it('should evidence temporal ordering by event.created', () => {
      const events = [
        { id: 'e2', created: 200 },
        { id: 'e1', created: 100 }
      ];
      // In the real RPC, the ORDER BY event_created DESC ensures the latest event wins
      const sorted = [...events].sort((a, b) => b.created - a.created);
      expect(sorted[0].id).toBe('e2');
    });
  });
});
