import { describe, test, expect, vi, beforeEach } from 'vitest'

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_EDGE_FUNCTION_CONTRACT_TEST_V2
 * Objetivo: Validar o contrato HTTP e as invariantes de segurança do handler Edge.
 * Importamos a lógica real para garantir fidelidade ao pacote manual.
 */

// Mock do runtime Deno para os testes
const mockDenoServe = vi.fn()
globalThis.Deno = {
  env: {
    get: (key: string) => {
      const envs: Record<string, string> = {
        'STRIPE_RESTRICTED_KEY': 'rk_test_123',
        'STRIPE_WEBHOOK_SECRET': 'whsec_123',
        'STRIPE_PRICE_ENTERPRISE_MONTHLY': 'price_123',
        'SUPABASE_URL': 'https://example.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'service_role_123'
      }
      return envs[key]
    }
  },
  serve: mockDenoServe
} as any

// Mock do SDK Stripe
const mockConstructEventAsync = vi.fn()
vi.mock('npm:stripe@22.4.0', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEventAsync: mockConstructEventAsync
      },
      httpClient: {}
    })),
    createFetchHttpClient: vi.fn(),
    createSubtleCryptoProvider: vi.fn()
  }
})

// Utilitário para rodar o handler que foi registrado no Deno.serve
async function runHandler(request: Request) {
  const handler = mockDenoServe.mock.calls[0][0]
  return await handler(request)
}

describe('Stripe Edge Function Contract Integrity', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Forçar carregamento do index.ts para registrar o handler
    // Usamos um timestamp para evitar cache de módulo se necessário, mas Vitest lida bem
    await import('./index.ts?' + Date.now())
  })

  test('1. GET retorna 405', async () => {
    const req = new Request('https://edge.func', { method: 'GET' })
    const res = await runHandler(req)
    expect(res.status).toBe(405)
  })

  test('2. POST sem assinatura retorna 400', async () => {
    const req = new Request('https://edge.func', { method: 'POST', body: '{}' })
    const res = await runHandler(req)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Missing signature')
  })

  test('3. Assinatura inválida retorna 400', async () => {
    mockConstructEventAsync.mockRejectedValue(new Error('Invalid signature'))
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'invalid' },
      body: '{}'
    })
    const res = await runHandler(req)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Webhook Error')
  })

  test('5. Livemode é rejeitado antes da RPC (retorna 400)', async () => {
    mockConstructEventAsync.mockResolvedValue({ livemode: true, type: 'checkout.session.completed' })
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    const res = await runHandler(req)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Livemode not supported')
  })

  test('6. Evento não suportado retorna 200 sem RPC', async () => {
    mockConstructEventAsync.mockResolvedValue({ livemode: false, type: 'unsupported.event' })
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    
    // Mock global fetch para verificar se a RPC foi chamada
    const spyFetch = vi.spyOn(globalThis, 'fetch')
    
    const res = await runHandler(req)
    expect(res.status).toBe(200)
    expect(spyFetch).not.toHaveBeenCalled()
  })

  test('7. checkout.session.expired válido chama a RPC uma vez', async () => {
    mockConstructEventAsync.mockResolvedValue({ 
      id: 'evt_1', 
      livemode: false, 
      type: 'checkout.session.expired',
      created: 123456,
      data: { object: { id: 'cs_1', metadata: {} } } 
    })
    
    const spyFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' })
    } as any)

    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{"raw":"body"}'
    })
    
    const res = await runHandler(req)
    expect(res.status).toBe(200)
    expect(spyFetch).toHaveBeenCalledTimes(1)
    
    // Verifica se não passou o payload bruto diretamente para a RPC (Narrowing check)
    const callArgs = spyFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1]?.body as string)
    expect(body.p_event_data.raw).toBeUndefined()
    expect(body.p_event_type).toBe('checkout.session.expired')
  })

  test('10. Raw body é lido exatamente uma vez', async () => {
    mockConstructEventAsync.mockResolvedValue({ livemode: false, type: 'invoice.paid', data: { object: {} } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as any)
    
    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: 'test-body'
    })
    
    const textSpy = vi.spyOn(req, 'text')
    await runHandler(req)
    expect(textSpy).toHaveBeenCalledTimes(1)
  })

  test('15. Falha da RPC não é transformada incorretamente em 200 (retorna 500)', async () => {
    mockConstructEventAsync.mockResolvedValue({ livemode: false, type: 'invoice.paid', data: { object: {} } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ 
      ok: false, 
      status: 500, 
      text: async () => 'Internal Error' 
    } as any)

    const req = new Request('https://edge.func', { 
      method: 'POST', 
      headers: { 'stripe-signature': 'valid' },
      body: '{}'
    })
    
    const res = await runHandler(req)
    expect(res.status).toBe(500)
  })
})
