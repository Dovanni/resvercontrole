import { createFileRoute } from '@tanstack/react-router';
import type Stripe from 'stripe';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        });
      },
      POST: async ({ request }) => {
        const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
        
        if (!STRIPE_WEBHOOK_SECRET) {
          console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET is not defined');
          return new Response(JSON.stringify({ error: 'Stripe configuration missing' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const signature = request.headers.get('stripe-signature');
        if (!signature) {
          console.error('[WEBHOOK] Missing stripe-signature header');
          return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        try {
          // IMPORTANT: Read body as text for verification
          const rawBody = await request.text();
          
          // Use dynamic import to isolate server-only Stripe logic
          const { getStripeClient, handleStripeWebhook } = await import('@/lib/stripe.server');
          const stripe = getStripeClient();

          if (!stripe) {
            console.error('[WEBHOOK] Stripe client not available');
            return new Response(JSON.stringify({ error: 'Stripe client not available' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            STRIPE_WEBHOOK_SECRET
          );
          
          if (event.livemode) {
            console.error('[WEBHOOK] Livemode event rejected in test phase');
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Process the event
          await handleStripeWebhook(event);

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('[WEBHOOK] Error processing webhook:', err.message);
          return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
