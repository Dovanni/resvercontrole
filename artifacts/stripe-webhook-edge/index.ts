import Stripe from 'npm:stripe@22.4.0'

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_EDGE_FUNCTION_HANDLER_V2
 * Descrição: Handler completo para Supabase Edge Function com SDK npm:stripe@22.4.0.
 */

const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_KEY') || '', {
  // @ts-ignore: compatibility for test mocks in Node/Vitest
  httpClient: Stripe.createFetchHttpClient ? Stripe.createFetchHttpClient() : ({} as any),
})


const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

Deno.serve(async (req) => {
  const { method } = req
  
  // Contrato HTTP 405 para métodos não-POST
  if (method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  
  // Contrato HTTP 400 para assinatura ausente
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  let event
  let body: string = ''
  try {
    body = await req.text()
    
    // Validação da assinatura usando provedor SubtleCrypto do Deno
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      endpointSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    )
  } catch (err: any) {
    // Contrato HTTP 400 para erro de validação (assinatura inválida)
    console.error(`[Webhook Security Error] ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Rejeição de livemode em ambiente Sandbox/Preview
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

  // Contrato HTTP 200 para eventos não suportados (silencioso, sem processamento)
  if (!supportedEvents.includes(event.type)) {
    return new Response('Event type not supported', { status: 200 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[Configuration Error] Missing Supabase environment variables')
      return new Response('Internal Server Error', { status: 500 })
    }

    // Sanitização e formatação do payload para a RPC
    const object = event.data.object as Record<string, any>
    const payload = {
      p_provider_event_id: event.id,
      p_event_type: event.type,
      p_payload_sha256: null,
      p_livemode: false,
      p_event_data: {
        id: object.id,
        object: object,
        customer: object.customer,
        subscription: object.subscription,
        status: object.status,
        metadata: object.metadata,
        plan_code: object.metadata?.plan_code || 'enterprise_monthly'
      },
      p_event_created: event.created,
      p_canonical_plan_code: object.metadata?.plan_code || 'enterprise_monthly',
      p_canonical_price_id: Deno.env.get('STRIPE_PRICE_ENTERPRISE_MONTHLY'),
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

    const result = await response.json()
    
    // Tratamento de status específico da RPC
    if (result.status === 'failed_retryable') {
       return new Response('Event resolution pending', { status: 503 })
    }

    // Contrato HTTP 200 para sucesso ou duplicados
    return new Response('OK', { status: 200 })
  } catch (err: any) {
    console.error(`[Internal Processing Error] ${err.message}`)
    return new Response('Internal Server Error', { status: 500 })
  }
})
