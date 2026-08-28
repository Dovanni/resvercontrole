import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { createStripeCheckoutSessionImpl } from '@/lib/billing.server'
import { isValidOrigin, isAuthorizedHost } from '@/lib/billing-status.server'
import { getSupabaseAdmin } from '@/integrations/supabase/client.server'

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

          // Bloqueio server-side definitivo: empresa institucional nunca inicia checkout.
          const supabaseAdmin = getSupabaseAdmin()
          const token = authHeader.replace('Bearer ', '')
          const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
          if (authError || !user) {
            return new Response(JSON.stringify({
              error: 'CHECKOUT_INITIALIZATION_FAILED',
              contract_version: CONTRACT_VERSION,
              reason_code: 'UNAUTHORIZED'
            }), { status: 401, headers: commonHeaders })
          }

          const { data: context, error: contextError } = await supabaseAdmin.rpc('get_company_subscription_context_admin', {
            p_empresa_id: empresaId,
            p_verified_user_id: user.id,
          })

          if (contextError || !context) {
            return new Response(JSON.stringify({
              error: 'CHECKOUT_INITIALIZATION_FAILED',
              contract_version: CONTRACT_VERSION,
              reason_code: 'COMPANY_ACCESS_DENIED'
            }), { status: 403, headers: commonHeaders })
          }

          if ((context as any).billing_mode === 'institutional') {
            return new Response(JSON.stringify({
              status: 'checkout_disabled',
              contract_version: CONTRACT_VERSION,
              reason_code: 'INSTITUTIONAL_MODE'
            }), { status: 403, headers: commonHeaders })
          }
          
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
