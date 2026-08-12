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

        // CSRF validation via strict Origin check
        if (!isValidOrigin(origin) || !isAuthorizedHost(host)) {
          console.warn(`[API/create-checkout] Unauthorized origin/host: host=${host}, origin=${origin}`)
          return new Response(JSON.stringify({ error: 'Unauthorized origin' }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        // Bearer authentication requirement
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        try {
          const body = await request.json()
          const { empresaId } = z.object({ empresaId: z.string().uuid() }).parse(body)
          
          const traceId = crypto.randomUUID();
          const result = await createStripeCheckoutSessionImpl(empresaId, traceId)
          
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error: any) {
          // Se for um erro JSON (nosso erro sanitizado)
          try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.error === "CHECKOUT_INITIALIZATION_FAILED") {
              return new Response(JSON.stringify(parsedError), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          } catch (e) {
            // Não é um erro JSON nosso
          }

          console.error('[API/create-checkout] Error:', error)
          return new Response(JSON.stringify({ 
            error: 'CHECKOUT_INITIALIZATION_FAILED',
            trace_id: traceId || null,
            stage: 'REQUEST_VALIDATED',
            reason_code: 'RESERVATION_RPC_UNEXPECTED_FAILURE',
            upstream_code: null,
            upstream_http_status: null
          }), { 
            status: error.message === 'Unauthorized' ? 401 : 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
