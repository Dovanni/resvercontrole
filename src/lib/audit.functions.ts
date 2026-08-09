import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const auditStripeSession = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getStripeClient } = await import("@/lib/stripe.server");
    const stripe = getStripeClient();
    if (!stripe) throw new Error("Stripe not configured");

    const sessions = await stripe.checkout.sessions.list({
      limit: 20,
      status: 'open'
    });

    const matches = [];
    for (const s of sessions.data) {
      if (s.livemode) continue;

      const metadata = s.metadata || {};
      if (metadata.empresa_id === data.empresaId) {
        const lineItems = await stripe.checkout.sessions.listLineItems(s.id, { limit: 5 });
        const li = lineItems.data[0];

        if (li && li.amount_total === 3590 && li.currency === 'brl' && li.quantity === 1) {
          matches.push({
            id: s.id, // We need the ID for the reconciliation tool call, but we won't show it to the user if not asked
            status: s.status,
            payment_status: s.payment_status,
            expires_at: s.expires_at,
            metadata: metadata,
            amount_total: li.amount_total,
            currency: li.currency,
            quantity: li.quantity,
            livemode: s.livemode
          });
        }
      }
    }
    return matches;
  });
