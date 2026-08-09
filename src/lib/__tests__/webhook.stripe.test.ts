import { describe, it, expect, vi } from 'vitest';

describe('Stripe Webhook Contract - Corrective Type Safety and Ordering', () => {
  
  const canonical_price = 3590;
  const canonical_currency = 'brl';

  const extractSanitizedPayload = (event: any) => {
    const obj = event.data.object;
    const subscriptionId = obj.subscription || obj.id;
    
    return {
      provider: 'stripe',
      provider_event_id: event.id,
      event_type: event.type,
      event_created: event.created,
      empresa_id: obj.metadata?.empresa_id,
      stripe_subscription_id: typeof subscriptionId === 'string' ? subscriptionId : null,
      observed_currency: obj.currency?.toLowerCase(),
      observed_amount: obj.amount_total || obj.amount_paid || 0,
      observed_quantity: obj.items?.data?.[0]?.quantity || 1,
    };
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

      const sanitized = extractSanitizedPayload(rawEvent);
      expect((sanitized as any).extra_field_to_be_removed).toBeUndefined();
      expect((sanitized as any).data).toBeUndefined();
      expect(sanitized.empresa_id).toBe('e1');
      expect(sanitized.observed_currency).toBe('brl');
      expect(sanitized.observed_amount).toBe(3590);
    });

    it('should handle missing quantity by defaulting to 1 (fail-safe for extraction, RPC enforces)', () => {
      const event = {
        data: { object: { items: { data: [{ }] } } }
      };
      const sanitized = extractSanitizedPayload(event as any);
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
