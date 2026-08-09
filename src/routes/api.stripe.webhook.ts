import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
        
        if (!STRIPE_WEBHOOK_SECRET) {
          return new Response('Stripe configuration missing', { status: 500 });
        }

        const signature = request.headers.get('stripe-signature');
        if (!signature) {
          return new Response('Missing stripe-signature', { status: 400 });
        }

        try {
          // Bun/TanStack Start environment: request.text() provides the raw body string
          const rawBody = await request.text();
          const { getStripeClient } = await import('@/lib/stripe.server');
          const stripe = getStripeClient();

          if (!stripe) {
            return new Response('Stripe client not available', { status: 500 });
          }

          const event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            STRIPE_WEBHOOK_SECRET
          );

          if (event.livemode) {
            console.error('Livemode event rejected in test phase');
            return new Response('Livemode not allowed', { status: 403 });
          }

          // Preparation for idempotency and event handling
          // provider + event_id uniqueness will be enforced at DB level in Phase 2B
          console.log(`Stripe webhook received: ${event.type} [${event.id}]`);

          // Event types prepared for sync:
          // checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid/payment_failed

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (err: any) {
          console.error(`Webhook signature verification failed: ${err.message}`);
          return new Response(`Webhook Error`, { status: 400 });
        }
      },
    },
  },
});
