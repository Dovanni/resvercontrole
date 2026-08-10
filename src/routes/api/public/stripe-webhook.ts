import { createFileRoute } from '@tanstack/react-router';
import Stripe from 'stripe';

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_WEBHOOK_TANSTACK_SERVER_ROUTE
 * Descrição: Implementação gerenciada do Stripe Webhook via TanStack Server Route.
 * Substitui a Edge Function devido a restrições de criação no TanStack Start v1.
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
        // 1. Contrato HTTP 405 para métodos não-POST é garantido pelo roteador, 
        // mas reforçamos a lógica do handler POST.

        const signature = request.headers.get('stripe-signature');
        
        // 2. Contrato HTTP 400 para assinatura ausente
        if (!signature) {
          return new Response('Missing signature', { status: 400 });
        }

        const restrictedKey = process.env['STRIPE_RESTRICTED_KEY'];
        const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'] || '';

        // Verificação de configuração crítica
        if (!restrictedKey) {
          console.error('[Configuration Error] Missing STRIPE_RESTRICTED_KEY');
          return new Response('Internal Server Error', { status: 500 });
        }

        // Inicialização do SDK dentro do handler
        const stripe = new Stripe(restrictedKey, {
          apiVersion: '2026-07-29.dahlia' as any, // Mantendo compatibilidade com schema do billing.server
          typescript: true,
        });

        let event: Stripe.Event;
        try {
          const body = await request.text();
          
          // Validação da assinatura usando o provedor SubtleCrypto (padrão em Workers/Deno)
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

        // 3. Rejeição de livemode em ambiente Sandbox/Preview
        if (event.livemode) {
          console.error('[Security] Livemode event rejected in sandbox environment');
          return new Response('Livemode not supported', { status: 400 });
        }

        // Narrowing dos sete eventos suportados
        const supportedEvents = [
          'checkout.session.completed',
          'checkout.session.expired',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.paid',
          'invoice.payment_failed'
        ];

        // 4. Contrato HTTP 200 para eventos não suportados (silencioso, sem processamento)
        if (!supportedEvents.includes(event.type)) {
          return new Response('Event type not supported', { status: 200 });
        }

        try {
          // No TanStack Start, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pelo Lovable Cloud
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

          // Type guard para extrair o objeto do evento de forma segura
          const eventData = event.data.object as unknown as Record<string, unknown>;
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
              status: eventData.status as string,
              metadata: metadata,
              plan_code: metadata.plan_code || 'enterprise_monthly'
            },
            p_event_created: event.created,
            p_canonical_plan_code: metadata.plan_code || 'enterprise_monthly',
            p_canonical_price_id: priceEnterpriseMonthly,
            p_canonical_currency: 'brl',
            p_canonical_amount: 3590 // R$ 35,90
          };

          // Chamada exclusiva à RPC via cliente administrativo interno (service_role)
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
            
            // Contrato HTTP 503 para erros retryable
            if (errorText.includes('UNLINKED') || response.status === 503) {
              return new Response('Temporarily unlinked or service unavailable', { status: 503 });
            }
            return new Response('Internal Server Error', { status: 500 });
          }

          const result = (await response.json()) as { status?: string };
          
          // Tratamento de status específico da RPC
          if (result.status === 'failed_retryable') {
             return new Response('Event resolution pending', { status: 503 });
          }

          // Contrato HTTP 200 para sucesso ou duplicados
          return new Response('OK', { status: 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown processing error';
          console.error(`[Internal Processing Error] ${message}`);
          return new Response('Internal Server Error', { status: 500 });
        }
      },
      // Bloqueio explícito de outros métodos conforme contrato
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
      PUT: async () => new Response('Method Not Allowed', { status: 405 }),
      DELETE: async () => new Response('Method Not Allowed', { status: 405 }),
      PATCH: async () => new Response('Method Not Allowed', { status: 405 }),
    },
  },
});
