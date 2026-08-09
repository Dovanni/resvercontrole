import Stripe from 'npm:stripe@22.4.0'

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_EDGE_FUNCTION_HANDLER_V2
 * Descrição: Handler completo para Supabase Edge Function com SDK npm:stripe@22.4.0.
 */

// Interface mínima para o payload da RPC
interface WebhookRpcPayload {
  p_provider_event_id: string
  p_event_type: string
  p_payload_sha256: string | null
  p_livemode: boolean
  p_event_data: {
    id: string
    object: unknown
    customer: string | null | unknown
    subscription: string | null | unknown
    status: string | null | unknown
    metadata: Record<string, string | undefined>
    plan_code: string
  }
  p_event_created: number
  p_canonical_plan_code: string
  p_canonical_price_id: string | undefined
  p_canonical_currency: string
  p_canonical_amount: number
}

Deno.serve(async (req: Request) => {
  const { method } = req
  
  // 1. Contrato HTTP 405 para métodos não-POST
  if (method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  
  // 2. Contrato HTTP 400 para assinatura ausente
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const restrictedKey = Deno.env.get('STRIPE_RESTRICTED_KEY')
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

  // Verificação de configuração crítica
  if (!restrictedKey) {
    console.error('[Configuration Error] Missing STRIPE_RESTRICTED_KEY')
    return new Response('Internal Server Error', { status: 500 })
  }

  // Inicialização do SDK dentro do handler para garantir leitura do Deno.env atualizado
  const stripe = new Stripe(restrictedKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event: Stripe.Event
  try {
    const body = await req.text()
    
    // Validação da assinatura usando provedor SubtleCrypto do Deno
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

  // 3. Rejeição de livemode em ambiente Sandbox/Preview
  if (event.livemode) {
    console.error('[Security] Livemode event rejected in sandbox environment')
    return new Response('Livemode not supported', { status: 400 })
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
  ]

  // 4. Contrato HTTP 200 para eventos não suportados (silencioso, sem processamento)
  if (!supportedEvents.includes(event.type)) {
    return new Response('Event type not supported', { status: 200 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const priceEnterpriseMonthly = Deno.env.get('STRIPE_PRICE_ENTERPRISE_MONTHLY')
    
    if (!supabaseUrl || !supabaseServiceRoleKey || !priceEnterpriseMonthly) {
      const missing = [
        !supabaseUrl && 'SUPABASE_URL',
        !supabaseServiceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !priceEnterpriseMonthly && 'STRIPE_PRICE_ENTERPRISE_MONTHLY'
      ].filter(Boolean)
      console.error(`[Configuration Error] Missing environment variables: ${missing.join(', ')}`)
      return new Response('Internal Server Error', { status: 500 })
    }

    // Type guard para extrair o objeto do evento de forma segura
    const eventData = event.data.object as unknown as Record<string, unknown>
    const metadata = (eventData.metadata as Record<string, string | undefined>) || {}
    
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
    }

    // Chamada exclusiva à RPC via cliente administrativo interno (service_role)
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
      console.error(`[RPC Execution Error] ${response.status}: ${errorText}`)
      
      // Contrato HTTP 503 para erros retryable
      if (errorText.includes('UNLINKED') || response.status === 503) {
        return new Response('Temporarily unlinked or service unavailable', { status: 503 })
      }
      return new Response('Internal Server Error', { status: 500 })
    }

    const result = (await response.json()) as { status?: string }
    
    // Tratamento de status específico da RPC
    if (result.status === 'failed_retryable') {
       return new Response('Event resolution pending', { status: 503 })
    }

    // Contrato HTTP 200 para sucesso ou duplicados
    return new Response('OK', { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error'
    console.error(`[Internal Processing Error] ${message}`)
    return new Response('Internal Server Error', { status: 500 })
  }
})
