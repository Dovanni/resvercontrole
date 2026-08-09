import Stripe from 'stripe'
import { createFileRoute } from '@tanstack/react-router'

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_EDGE_FUNCTION_LOVABLE_MANAGED_DEPLOYMENT_AUTHORIZATION
 * 
 * Implementação do Webhook Stripe via TanStack Server Route devido a restrições
 * de infraestrutura para criação de novas Supabase Edge Functions.
 * 
 * Este arquivo replica a lógica aprovada no pacote canônico:
 * artifacts/stripe-webhook-edge/index.ts
 */

export const Route = createFileRoute('/api/public/stripe-webhook')({
  server: {
    handlers: {
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
      POST: async ({ request }) => {
        const signature = request.headers.get('stripe-signature')
        
        // 1. Contrato HTTP 400 para assinatura ausente
        if (!signature) {
          return new Response('Missing signature', { status: 400 })
        }

        const restrictedKey = process.env['STRIPE_RESTRICTED_KEY']
        const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'] || ''

        // Verificação de configuração crítica
        if (!restrictedKey) {
          console.error('[Configuration Error] Missing STRIPE_RESTRICTED_KEY')
          return new Response('Internal Server Error', { status: 500 })
        }

        const stripe = new Stripe(restrictedKey, {
          httpClient: Stripe.createFetchHttpClient(),
        })

        let event: Stripe.Event
        try {
          const body = await request.text()
          
          // Validação da assinatura
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            endpointSecret,
            undefined,
            Stripe.createSubtleCryptoProvider()
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.error(`[Webhook Security Error] ${message}`)
          return new Response(`Webhook Error: ${message}`, { status: 400 })
        }

        // 2. Rejeição de livemode em ambiente Sandbox/Preview
        if (event.livemode) {
          console.error('[Security] Livemode event rejected in sandbox environment')
          return new Response('Livemode not supported', { status: 400 })
        }

        // Narrowing dos eventos suportados
        const supportedEvents = [
          'checkout.session.completed',
          'checkout.session.expired',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.paid',
          'invoice.payment_failed'
        ]

        // 3. Contrato HTTP 200 para eventos não suportados
        if (!supportedEvents.includes(event.type)) {
          return new Response('Event type not supported', { status: 200 })
        }

        try {
          const supabaseUrl = process.env['VITE_SUPABASE_URL']
          const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
          const priceEnterpriseMonthly = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY']
          
          if (!supabaseUrl || !supabaseServiceRoleKey || !priceEnterpriseMonthly) {
            console.error('[Configuration Error] Missing critical env vars for RPC processing')
            return new Response('Internal Server Error', { status: 500 })
          }

          const eventData = event.data.object as unknown as Record<string, unknown>
          const metadata = (eventData.metadata as Record<string, string | undefined>) || {}
          
          const payload = {
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
            p_canonical_amount: 3590
          }

          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/process_stripe_webhook_event`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
              'apikey': supabaseServiceRoleKey
            },
            body: JSON.stringify(payload)
          })

          if (!response.ok) {
            const errorText = await response.text()
            if (errorText.includes('UNLINKED') || response.status === 503) {
              return new Response('Temporarily unlinked', { status: 503 })
            }
            return new Response('Internal Server Error', { status: 500 })
          }

          const result = (await response.json()) as { status?: string }
          if (result.status === 'failed_retryable') {
             return new Response('Event resolution pending', { status: 503 })
          }

          return new Response('OK', { status: 200 })
        } catch (err) {
          return new Response('Internal Server Error', { status: 500 })
        }
      }
    }
  }
})
