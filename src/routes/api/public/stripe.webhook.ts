import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
      POST: async ({ request }) => {
        try {
          console.log('[DEBUG WEBHOOK] Request received');
          const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
          
          if (!STRIPE_WEBHOOK_SECRET) {
            return new Response('Stripe configuration missing', { status: 500 });
          }

          const signature = request.headers.get('stripe-signature');
          if (!signature) {
            return new Response('Missing stripe-signature', { status: 400 });
          }

          const rawBody = await request.text();
          
          // Use dynamic import to isolate potential module-level crashes
          const { getStripeClient, handleStripeWebhook } = await import('@/lib/stripe.server');
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
            return new Response('Forbidden', { status: 403 });
          }

          await handleStripeWebhook(event);

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('[DEBUG WEBHOOK] Error:', err.message);
          // Return 400 for constructEvent failures as per Stripe docs
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }
      }
    }
  }
});
