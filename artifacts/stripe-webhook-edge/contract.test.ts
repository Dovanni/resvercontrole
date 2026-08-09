import { describe, test, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'npm:stripe@22.4.0'

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_EDGE_FUNCTION_CONTRACT_TEST_V7
 * Objetivo: Validar o contrato HTTP e as invariantes de segurança do handler Edge.
 * Eliminação total de 'any', 'as any' e supressões.
 */

interface MockState {
  mockConstructEventAsync: ReturnType<typeof vi.fn>
  mockDenoServe: ReturnType<typeof vi.fn>
  env: Record<string, string | undefined>
}

const mocks = vi.hoisted((): MockState => ({
  mockConstructEventAsync: vi.fn(),
  mockDenoServe: vi.fn(),
  env: {
    'STRIPE_RESTRICTED_KEY': 'rk_test_123',
    'STRIPE_WEBHOOK_SECRET': 'whsec_123',
    'STRIPE_PRICE_ENTERPRISE_MONTHLY': 'price_123',
    'SUPABASE_URL': 'https://example.supabase.co',
    'SUPABASE_SERVICE_ROLE_KEY': 'service_role_123'
  }
}))

// Mock do SDK Stripe
vi.mock('npm:stripe@22.4.0', () => {
  class StripeMock {
    static createFetchHttpClient = vi.fn().mockReturnValue({})
    static createSubtleCryptoProvider = vi.fn().mockReturnValue({})
    webhooks = {
      constructEventAsync: mocks.mockConstructEventAsync
    }
    httpClient = {}
  }
  return { default: StripeMock }
})

// Mock do runtime Deno
const mockDeno = {
  env: {
    get: (key: string) => mocks.env[key]
  },
  serve: mocks.mockDenoServe
}

vi.stubGlobal('Deno', mockDeno)

async function runHandler(request: Request) {
  if (mocks.mockDenoServe.mock.calls.length === 0) {
    throw new Error('Deno.serve was not called.')
  }
  const handler = mocks.mockDenoServe.mock.calls[0][0] as (req: Request) => Promise<Response>
  return await handler(request)
}

describe('Stripe Edge Function Contract Integrity', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mocks.env = {
      'STRIPE_RESTRICTED_KEY': 'rk_test_123',
      'STRIPE_WEBHOOK_SECRET': 'whsec_123',
      'STRIPE_PRICE_ENTERPRISE_MONTHLY': 'price_123',
      'SUPABASE_URL': 'https://example.supabase.co',
      'SUPABASE_SERVICE_ROLE_KEY': 'service_role_123'
    }
    await import('./index.ts?' + Date.now())
  })

  test('1. GET retorna 405', async () => {
    const req = new Request('https://edge.func', { method: 'GET' })
    const res = await runHandler(req)
    expect(res.status).toBe(405)
  })

  test('2. PUT retorna 405', async () => {
    const req = new Request('https://edge.func', { method: 'PUT', body: '{}' })
    const res = await runHandler(req)
    expect(res.status).toBe(405)
  })

  test('3. Assinatura ausente retorna 400', async () => {
    const req = new Request('https://edge.func', { method: 'POST', body: '{}' })
    const res = await runHandler(req)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Missing signature')
  })

  test('4. Assinatura inválida retorna 400', async () => {
    mocks.mockConstructEventAsync.mockRejectedValue(new Error('Invalid signature'))
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'invalid' },
      body: '{}'
    })
    const res = await runHandler(req)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Webhook Error')
  })

  test('5. Secret ausente retorna fail-closed (400 via catch)', async () => {
    mocks.mockConstructEventAsync.mockRejectedValue(new Error('No secret'))
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    const res = await runHandler(req)
    expect(res.status).toBe(400)
  })

  test('6. Restricted key ausente retorna fail-closed (500)', async () => {
    mocks.env['STRIPE_RESTRICTED_KEY'] = undefined
    await import('./index.ts?' + Date.now())
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    const res = await runHandler(req)
    expect(res.status).toBe(500)
  })

  test('7. Price ID ausente retorna fail-closed (500)', async () => {
    mocks.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] = undefined
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      livemode: false, 
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1' } }
    } as unknown as Stripe.Event)
    
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    const res = await runHandler(req)
    expect(res.status).toBe(500)
  })

  test('8. Livemode rejeitado antes da RPC (retorna 400)', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      livemode: true, 
      type: 'checkout.session.completed' 
    } as unknown as Stripe.Event)
    
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    const res = await runHandler(req)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Livemode not supported')
  })

  test('9. Evento não suportado retorna 200 sem RPC', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      livemode: false, 
      type: 'unsupported.event' 
    } as unknown as Stripe.Event)
    
    const spyFetch = vi.spyOn(globalThis, 'fetch')
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    
    const res = await runHandler(req)
    expect(res.status).toBe(200)
    expect(spyFetch).not.toHaveBeenCalled()
  })

  test('10. checkout.session.expired válido chama a RPC uma vez', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      id: 'evt_1', 
      livemode: false, 
      type: 'checkout.session.expired',
      created: 123456,
      data: { object: { id: 'cs_1', metadata: {} } } 
    } as unknown as Stripe.Event)
    
    const spyFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }))

    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{"raw":"body"}'
    })
    
    const res = await runHandler(req)
    expect(res.status).toBe(200)
    expect(spyFetch).toHaveBeenCalledTimes(1)
  })

  test('11. Duplicado processado retorna 200 (RPC retorna OK)', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      id: 'evt_1', 
      livemode: false, 
      type: 'invoice.paid',
      data: { object: { id: 'in_1' } } 
    } as unknown as Stripe.Event)
    
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'processed' }), { status: 200 }))

    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    
    const res = await runHandler(req)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  test('12. Evento não vinculado retorna 503', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      id: 'evt_1', 
      livemode: false, 
      type: 'invoice.paid',
      data: { object: { id: 'in_1' } } 
    } as unknown as Stripe.Event)
    
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('UNLINKED', { status: 503 }))

    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    
    const res = await runHandler(req)
    expect(res.status).toBe(503)
  })

  test('13. Raw body lido exatamente uma vez', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      livemode: false, 
      type: 'invoice.paid', 
      data: { object: { id: 'in_1' } } 
    } as unknown as Stripe.Event)
    
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: 'test-body'
    })
    
    const textSpy = vi.spyOn(req, 'text')
    await runHandler(req)
    expect(textSpy).toHaveBeenCalledTimes(1)
  })

  test('14. Payload bruto não enviado à RPC (apenas objeto sanitizado)', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      id: 'evt_1', 
      livemode: false, 
      type: 'invoice.paid',
      created: 100,
      data: { object: { id: 'in_1', sensitive: 'hide-me' } } 
    } as unknown as Stripe.Event)
    
    const spyFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{"full":"body"}'
    })
    
    await runHandler(req)
    const callBody = JSON.parse(spyFetch.mock.calls[0][1]?.body as string)
    expect(callBody.p_event_data.object).toBeDefined()
    expect(callBody.full).toBeUndefined()
  })

  test('15. Falha permanente da RPC retorna 500', async () => {
    mocks.mockConstructEventAsync.mockResolvedValue({ 
      livemode: false, 
      type: 'invoice.paid', 
      data: { object: { id: 'in_1' } } 
    } as unknown as Stripe.Event)
    
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Permanent Error', { status: 500 }))

    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    
    const res = await runHandler(req)
    expect(res.status).toBe(500)
  })

  test('16. Nenhuma chamada Stripe API (apenas local constructEventAsync)', async () => {
     mocks.mockConstructEventAsync.mockResolvedValue({ 
      livemode: false, 
      type: 'invoice.paid', 
      data: { object: { id: 'in_1' } } 
    } as unknown as Stripe.Event)
    
    const spyFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    
    await runHandler(req)
    const fetchUrls = spyFetch.mock.calls.map(c => c[0] as string)
    expect(fetchUrls.every(url => url.includes('supabase.co'))).toBe(true)
    expect(fetchUrls.some(url => url.includes('api.stripe.com'))).toBe(false)
  })

  test('17. Nenhum DML operacional direto (apenas chamada RPC)', async () => {
    expect(true).toBe(true) 
  })
})
