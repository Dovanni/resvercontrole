import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { createStripePortalSessionImpl } from '@/lib/billing-portal.server';
import { isValidOrigin } from '@/lib/billing-status.server';

const portalSchema = z.object({
  empresaId: z.string().uuid(),
});

export const Route = createFileRoute('/api/public/billing/create-portal-session')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const params = portalSchema.safeParse(body);

          if (!params.success) {
            return new Response(JSON.stringify({ error: 'INVALID_INPUT' }), { status: 400 });
          }

          const { empresaId } = params.data;
          const authHeader = request.headers.get('Authorization');
          const token = authHeader?.replace('Bearer ', '');

          if (!token) {
            return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
          }

          const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !user) {
            return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
          }

          // Validar acesso (Membership Admin)
          const { data: membership, error: memberError } = await supabaseAdmin
            .from('user_company_access')
            .select('role')
            .eq('empresa_id', empresaId)
            .eq('user_id', user.id)
            .single();

          if (memberError || !membership || membership.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
          }

          const origin = request.headers.get('origin') || request.headers.get('referer');
          const host = request.headers.get('host');

          if (!isValidOrigin(origin)) {
            return new Response(JSON.stringify({ error: 'INVALID_ORIGIN' }), { status: 403 });
          }

          const result = await createStripePortalSessionImpl(empresaId, origin!, host);
          
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error: any) {
          console.error('[PortalSessionRoute] Failure:', error);
          const status = error.message === 'CUSTOMER_NOT_FOUND' ? 404 : 500;
          return new Response(JSON.stringify({ error: error.message || 'INTERNAL_ERROR' }), { status });
        }
      }
    }
  }
});
