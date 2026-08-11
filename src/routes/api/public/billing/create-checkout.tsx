import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { createStripeCheckoutSessionImpl } from '@/lib/billing.server'
import { isValidOrigin, isAuthorizedHost } from '@/lib/billing-status.server'

export const Route = createFileRoute('/api/public/billing/create-checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const host = request.headers.get('host')
        const origin = request.headers.get('origin')

        // Validação rigorosa de origem antes de qualquer lógica
        if (!isValidOrigin(origin) || !isAuthorizedHost(host)) {
          console.warn(`[API/create-checkout] Unauthorized request: host=${host}, origin=${origin}`)
          return new Response(JSON.stringify({ error: 'Unauthorized origin' }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        try {
          const body = await request.json()
          const { empresaId } = z.object({ empresaId: z.string().uuid() }).parse(body)
          
          const result = await createStripeCheckoutSessionImpl(empresaId)
          
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          console.error('[API/create-checkout] Error:', error)
          return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
            status: error.message === 'Unauthorized' ? 401 : 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
