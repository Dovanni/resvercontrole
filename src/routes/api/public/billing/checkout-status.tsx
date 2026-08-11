import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getCheckoutStatusImpl, isValidOrigin, isAuthorizedHost, getBillingEnvironment } from '@/lib/billing-status.server'
import { createStripeCheckoutSessionImpl } from '@/lib/billing.server'

export const Route = createFileRoute('/api/public/billing/checkout-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const empresaId = url.searchParams.get('empresaId')
        
        if (!empresaId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId)) {
          return new Response(JSON.stringify({ error: 'Invalid empresaId' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const host = request.headers.get('host')
        const origin = request.headers.get('origin')
        
        const status = await getCheckoutStatusImpl(empresaId, host, origin)
        
        return new Response(JSON.stringify(status), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-store'
          }
        })
      }
    }
  }
})
