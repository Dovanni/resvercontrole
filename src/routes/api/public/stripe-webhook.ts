import Stripe from 'stripe';
import { createFileRoute } from '@tanstack/react-router';

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_WEBHOOK_TANSTACK_SERVER_ROUTE_V2
 * Descrição: Handler gerenciado do Stripe Webhook via TanStack Server Route.
 * Implementa byte-identicamente a lógica do pacote artifacts/stripe-webhook-edge/index.ts.
 */

interface WebhookRpcPayload {
  p_provider_event_id: string;
  p_event_type: string;
  p_payload_sha256: string | null;
  p_livemode: boolean;
  p_event_data: {
    id: string;
    object: unknown;
    customer: string | null | unknown;
    subscription: string | null | unknown;
    status: string | null | unknown;
    metadata: Record<string, string | undefined>;
    plan_code: string;
  };
  p_event_created: number;
  p_canonical_plan_code: string;
  p_canonical_price_id: string | undefined;
  p_canonical_currency: string;
  p_canonical_amount: number;
}

export const Route = createFileRoute('/api/public/stripe-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get('stripe-signature');
        
        if (!signature) {
          return new Response('Missing signature', { status: 400 });
        }

        const restrictedKey = process.env['STRIPE_RESTRICTED_KEY'];
        const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'] || '';

        if (!restrictedKey) {
          console.error('[Configuration Error] Missing STRIPE_RESTRICTED_KEY');
          return new Response('Internal Server Error', { status: 500 });
        }

        const stripe = new Stripe(restrictedKey, {
          httpClient: Stripe.createFetchHttpClient(),
        });

        let event: Stripe.Event;
        try {
          const body = await request.text();
          
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            endpointSecret,
            undefined,
            Stripe.createSubtleCryptoProvider()
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[Webhook Security Error] ${message}`);
          return new Response(`Webhook Error: ${message}`, { status: 400 });
        }

        if (event.livemode) {
          console.error('[Security] Livemode event rejected in sandbox environment');
          return new Response('Livemode not supported', { status: 400 });
        }

        const supportedEvents = [
          'checkout.session.completed',
          'checkout.session.expired',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.paid',
          'invoice.payment_failed'
        ];

        if (!supportedEvents.includes(event.type)) {
          return new Response('Event type not supported', { status: 200 });
        }

        try {
          const supabaseUrl = process.env['VITE_SUPABASE_URL'];
          const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
          const priceEnterpriseMonthly = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'];
          
          if (!supabaseUrl || !supabaseServiceRoleKey || !priceEnterpriseMonthly) {
            const missing = [
              !supabaseUrl && 'VITE_SUPABASE_URL',
              !supabaseServiceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
              !priceEnterpriseMonthly && 'STRIPE_PRICE_ENTERPRISE_MONTHLY'
            ].filter(Boolean);
            console.error(`[Configuration Error] Missing environment variables: ${missing.join(', ')}`);
            return new Response('Internal Server Error', { status: 500 });
          }

          const eventData = event.data.object as any;
          const metadata = (eventData.metadata as Record<string, string | undefined>) || {};
          
          const payload: WebhookRpcPayload = {
            p_provider_event_id: event.id,
            p_event_type: event.type,
            p_payload_sha256: null,
            p_livemode: false,
            p_event_data: {
              id: String(eventData.id || ''),
              object: eventData,
              customer: eventData.customer,
              subscription: eventData.subscription,
              status: eventData.status,
              metadata: metadata,
              plan_code: metadata.plan_code || 'enterprise_monthly'
            },
            p_event_created: event.created,
            p_canonical_plan_code: metadata.plan_code || 'enterprise_monthly',
            p_canonical_price_id: priceEnterpriseMonthly,
            p_canonical_currency: 'brl',
            p_canonical_amount: 3590 // R$ 35,90
          };

          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/process_stripe_webhook_event`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
              'apikey': supabaseServiceRoleKey
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[RPC Execution Error] ${response.status}: ${errorText}`);
            
            if (errorText.includes('UNLINKED') || response.status === 503) {
              return new Response('Temporarily unlinked or service unavailable', { status: 503 });
            }
            return new Response('Internal Server Error', { status: 500 });
          }

          const result = (await response.json()) as { status?: string };
          
          if (result.status === 'failed_retryable') {
             return new Response('Event resolution pending', { status: 503 });
          }

          return new Response('OK', { status: 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown processing error';
          console.error(`[Internal Processing Error] ${message}`);
          return new Response('Internal Server Error', { status: 500 });
        }
      },
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
    },
  },
});
