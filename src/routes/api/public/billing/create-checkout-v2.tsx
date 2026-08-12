import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { createStripeCheckoutSessionImpl } from '@/lib/billing.server'
import { isValidOrigin, isAuthorizedHost } from '@/lib/billing-status.server'

export const Route = createFileRoute('/api/public/billing/create-checkout-v2')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const CONTRACT_VERSION = 'reservation-observability-v2'
        const MARKER_HEADER = { 'X-Vejamais-Checkout-Contract': CONTRACT_VERSION }
        
        const host = request.headers.get('host')
        const origin = request.headers.get('origin')

        const commonHeaders = {
          ...MARKER_HEADER,
          'Content-Type': 'application/json'
        }

        // 1. Validar Origin/Host
        if (!isValidOrigin(origin) || !isAuthorizedHost(host)) {
          return new Response(JSON.stringify({ 
            error: 'CHECKOUT_INITIALIZATION_FAILED',
            contract_version: CONTRACT_VERSION,
            reason_code: 'UNAUTHORIZED_ORIGIN'
          }), { 
            status: 403,
            headers: commonHeaders
          })
        }

        // 2. Validar Auth
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ 
            error: 'CHECKOUT_INITIALIZATION_FAILED',
            contract_version: CONTRACT_VERSION,
            reason_code: 'UNAUTHORIZED'
          }), {
            status: 401,
            headers: commonHeaders
          })
        }

        let traceId = crypto.randomUUID();
        try {
          const body = await request.json()
          const { empresaId } = z.object({ empresaId: z.string().uuid() }).parse(body)
          
          const result = await createStripeCheckoutSessionImpl(empresaId, traceId)
          
          return new Response(JSON.stringify({
            ...result,
            contract_version: CONTRACT_VERSION
          }), {
            status: 200,
            headers: commonHeaders
          })
        } catch (error: any) {
          let sanitizedResponse: any = {
            error: 'CHECKOUT_INITIALIZATION_FAILED',
            contract_version: CONTRACT_VERSION,
            trace_id: traceId
          };

          try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.error === "CHECKOUT_INITIALIZATION_FAILED") {
              sanitizedResponse = {
                ...sanitizedResponse,
                stage: parsedError.stage,
                reason_code: parsedError.reason_code,
                upstream_code: parsedError.upstream_code,
                upstream_http_status: parsedError.upstream_http_status
              };
            }
          } catch (e) {
            sanitizedResponse.reason_code = 'UNEXPECTED_RUNTIME_ERROR';
          }

          const status = error.message === 'Unauthorized' ? 401 : 
                         error.message?.includes('Forbidden') ? 403 : 500;

          return new Response(JSON.stringify(sanitizedResponse), { 
            status,
            headers: commonHeaders
          })
        }
      }
    }
  }
})
