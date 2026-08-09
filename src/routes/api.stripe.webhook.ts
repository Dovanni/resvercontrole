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

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { createHash } = await import('crypto');
          
          const payloadHash = createHash('sha256').update(rawBody).digest('hex');

          // Process the event using the transactional RPC with strict validation
          const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_stripe_webhook_event', {
            p_provider_event_id: event.id,
            p_event_type: event.type,
            p_payload_sha256: payloadHash,
            p_livemode: false,
            p_event_data: event.data as any,
            p_event_created: event.created,
            p_canonical_plan_code: 'enterprise_monthly',
            p_canonical_currency: 'brl',
            p_canonical_amount: 3590
          });

          if (rpcError) {
            console.error(`RPC error processing webhook [${event.id}]:`, rpcError);
            return new Response('Error processing event', { status: 500 });
          }

          const resultData = result as any;
          const status = resultData?.status;
          
          if (status === 'failed_retryable') {
            console.warn(`Retryable failure for event [${event.id}]: ${resultData?.reason || 'unlinked'}`);
            return new Response(JSON.stringify({ received: true, status }), {
              status: 503, // Service Unavailable for retry
              headers: { 'Content-Type': 'application/json' },
            });
          }

          console.log(`Stripe webhook processed: ${event.type} [${event.id}] - Status: ${status}`);

          return new Response(JSON.stringify({ received: true, status }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });

        } catch (err: any) {
          console.error(`Webhook processing failed: ${err.message}`);
          return new Response(`Webhook Error`, { status: 400 });
        }

      },
    },
  },
});
