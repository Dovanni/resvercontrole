import { createFileRoute } from '@tanstack/react-router';
import type Stripe from 'stripe';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
      POST: async ({ request }) => {
        const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
        
        if (!STRIPE_WEBHOOK_SECRET) {
          console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET is not defined');
          return new Response('Stripe configuration missing', { status: 500 });
        }

        const signature = request.headers.get('stripe-signature');
        if (!signature) {
          console.error('[WEBHOOK] Missing stripe-signature header');
          return new Response('Missing stripe-signature', { status: 400 });
        }

        try {
          const rawBody = await request.text();
          console.log('[WEBHOOK] Body length:', rawBody.length);
          
          const { getStripeClient } = await import('@/lib/stripe.server');
          const stripe = getStripeClient();

          if (!stripe) {
            console.error('[WEBHOOK] Stripe client not available');
            return new Response('Stripe client not available', { status: 500 });
          }

          const event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            STRIPE_WEBHOOK_SECRET
          );
          
          console.log('[WEBHOOK] Event constructed:', event.type);

          if (event.livemode) {
            console.error('[WEBHOOK] Livemode event rejected in test phase');
            return new Response('Forbidden', { status: 403 });
          }

          const { handleStripeWebhook } = await import('@/lib/stripe.server');
          await handleStripeWebhook(event);

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('[WEBHOOK] Error processing webhook:', err.message);
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }
      }
    }
  }
});
