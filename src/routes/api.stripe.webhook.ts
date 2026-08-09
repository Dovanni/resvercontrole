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

          // ETAPA 1: Remocao de coercoes inseguras e materializacao de payload sanitizado estrito
          const obj = event.data.object as any;
          const subscriptionId = obj.subscription || obj.id;
          
          // Dahlia Contract Extractor - Strict fields only
          const sanitizedPayload = {
            provider: 'stripe',
            provider_event_id: event.id,
            event_type: event.type,
            event_created: event.created,
            event_priority: 0, // Default priority
            empresa_id: obj.metadata?.empresa_id,
            internal_subscription_id: obj.metadata?.subscription_id,
            plan_code: obj.metadata?.plan_code,
            stripe_customer_id: obj.customer,
            stripe_subscription_id: typeof subscriptionId === 'string' ? subscriptionId : null,
            stripe_checkout_session_id: event.type === 'checkout.session.completed' ? event.id : null,
            observed_price_id: obj.items?.data?.[0]?.price?.id || obj.amount_total ? null : null, // Handled inside RPC
            observed_currency: obj.currency?.toLowerCase(),
            observed_amount: obj.amount_total || obj.amount_paid || 0,
            observed_quantity: obj.items?.data?.[0]?.quantity || 1,
            current_period_start: obj.current_period_start,
            current_period_end: obj.current_period_end,
            cancel_at_period_end: obj.cancel_at_period_end,
            payload_sha256: payloadHash
          };

          // Runtime Validation Check - Reject if critical fields missing
          if (!sanitizedPayload.empresa_id) {
            console.error(`Rejected webhook [${event.id}]: Missing empresa_id in metadata`);
            return new Response('Missing metadata', { status: 400 });
          }

          const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_stripe_webhook_event', {
            p_provider_event_id: sanitizedPayload.provider_event_id,
            p_event_type: sanitizedPayload.event_type,
            p_payload_sha256: sanitizedPayload.payload_sha256,
            p_livemode: false,
            p_event_data: sanitizedPayload as unknown as import('@/integrations/supabase/types').Json,
            p_event_created: sanitizedPayload.event_created,
            p_canonical_plan_code: 'enterprise_monthly',
            p_canonical_currency: 'brl',
            p_canonical_amount: 3590
          });

          if (rpcError) {
            console.error(`RPC error processing webhook [${event.id}]:`, rpcError);
            return new Response('Error processing event', { status: 500 });
          }

          const resultData = result as { status?: string; reason?: string };
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

        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Webhook processing failed: ${message}`);
          return new Response(`Webhook Error`, { status: 400 });
        }

      },
    },
  },
});
