import { createFileRoute } from '@tanstack/react-router';
import type Stripe from 'stripe';

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

          // ETAPA 1: Remocao de coercoes inseguras e narrowing tipado por event.type
          let sanitizedPayload: any = null;

          switch (event.type) {
            case 'checkout.session.completed': {
              const session = event.data.object as Stripe.Checkout.Session;
              sanitizedPayload = {
                provider: 'stripe',
                provider_event_id: event.id,
                event_type: event.type,
                event_created: event.created,
                event_priority: 0,
                empresa_id: session.metadata?.empresa_id,
                internal_subscription_id: session.metadata?.subscription_id,
                plan_code: session.metadata?.plan_code,
                stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
                stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
                stripe_checkout_session_id: session.id,
                observed_price_id: null, // Will be validated via invoice.paid or verified subscription
                observed_currency: session.currency?.toLowerCase(),
                observed_amount: session.amount_total || 0,
                observed_quantity: 1, // Checkout sessions for this project are always quantity=1
                current_period_start: null,
                current_period_end: null,
                cancel_at_period_end: false,
                payload_sha256: payloadHash
              };
              break;
            }
            case 'invoice.paid': {
              const invoice = event.data.object as Stripe.Invoice;
              const lineItem = invoice.lines.data[0];
              sanitizedPayload = {
                provider: 'stripe',
                provider_event_id: event.id,
                event_type: event.type,
                event_created: event.created,
                event_priority: 10, // Higher priority for payment
                empresa_id: invoice.metadata?.empresa_id || (invoice as any).subscription_details?.metadata?.empresa_id,
                internal_subscription_id: invoice.metadata?.subscription_id || (invoice as any).subscription_details?.metadata?.subscription_id,
                plan_code: invoice.metadata?.plan_code || (invoice as any).subscription_details?.metadata?.plan_code,
                stripe_customer_id: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
                stripe_subscription_id: typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as any)?.id,
                stripe_checkout_session_id: null,
                observed_price_id: (lineItem as any)?.price?.id,
                observed_currency: invoice.currency?.toLowerCase(),
                observed_amount: invoice.amount_paid,
                observed_quantity: lineItem?.quantity || 1,
                current_period_start: invoice.period_start,
                current_period_end: invoice.period_end,
                cancel_at_period_end: false,
                payload_sha256: payloadHash
              };
              break;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
              const subscription = event.data.object as Stripe.Subscription;
              sanitizedPayload = {
                provider: 'stripe',
                provider_event_id: event.id,
                event_type: event.type,
                event_created: event.created,
                event_priority: 5,
                empresa_id: subscription.metadata?.empresa_id,
                internal_subscription_id: subscription.metadata?.subscription_id,
                plan_code: subscription.metadata?.plan_code,
                stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
                stripe_subscription_id: subscription.id,
                stripe_checkout_session_id: null,
                observed_price_id: subscription.items.data[0]?.price?.id,
                observed_currency: subscription.currency?.toLowerCase(),
                observed_amount: (subscription.items.data[0]?.plan as any)?.amount || 0,
                observed_quantity: subscription.items.data[0]?.quantity || 1,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end,
                payload_sha256: payloadHash
              };
              break;
            }
            default:
              console.log(`Unhandled event type: ${event.type}`);
              return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
          }

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
            p_event_data: sanitizedPayload,
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
