import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      GET: async () => {
        try {
          console.log('[DEBUG WEBHOOK HANDLER] Starting GET handler');
          return new Response('Method Not Allowed', { 
            status: 405,
            headers: { 'Content-Type': 'text/plain' }
          });
        } catch (e) {
          console.error('[DEBUG WEBHOOK HANDLER] GET error:', e);
          throw e;
        }
      },
      POST: async ({ request }) => {
        try {
          console.log('[DEBUG WEBHOOK HANDLER] Starting POST handler');
          const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
          
          if (!STRIPE_WEBHOOK_SECRET) {
            console.error('[DEBUG WEBHOOK] Secret missing');
            return new Response('Stripe configuration missing', { status: 500 });
          }

          const signature = request.headers.get('stripe-signature');
          if (!signature) {
            console.error('[DEBUG WEBHOOK] Signature missing');
            return new Response('Missing stripe-signature', { status: 400 });
          }

          const rawBody = await request.text();
          console.log('[DEBUG WEBHOOK] Body read, length:', rawBody.length);
          
          const { getStripeClient, handleStripeWebhook } = await import('@/lib/stripe.server');
          const stripe = getStripeClient();

          if (!stripe) {
            console.error('[DEBUG WEBHOOK] Stripe client null');
            return new Response('Stripe client not available', { status: 500 });
          }

          const event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            STRIPE_WEBHOOK_SECRET
          );
          
          console.log('[DEBUG WEBHOOK] Event constructed:', event.type);
          
          if (event.livemode) {
            console.error('[DEBUG WEBHOOK] Livemode rejected');
            return new Response('Forbidden', { status: 403 });
          }

          await handleStripeWebhook(event);

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('[DEBUG WEBHOOK] Error:', err.message);
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }
      }
    }
  }
});
