import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/integrations/supabase/client.server';
import { createStripePortalSessionImpl } from '@/lib/billing-portal.server';
import { isValidOrigin } from '@/lib/billing-status.server';

const portalSchema = z.object({
  empresaId: z.string().uuid(),
});

export const Route = createFileRoute('/api/public/billing/create-portal-session')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseAdmin = getSupabaseAdmin();
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

          const { data: membership, error: memberError } = await supabaseAdmin
            .from('user_company_access')
            .select('role')
            .eq('empresa_id', empresaId)
            .eq('user_id', user.id)
            .single();

          if (memberError || !membership || membership.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403 });
          }

          const { data: context, error: contextError } = await supabaseAdmin.rpc('get_company_subscription_context_admin', {
            p_empresa_id: empresaId,
            p_verified_user_id: user.id,
          });

          if (contextError || !context) {
            return new Response(JSON.stringify({ error: 'COMPANY_ACCESS_DENIED' }), { status: 403 });
          }

          if ((context as any).billing_mode === 'institutional') {
            return new Response(JSON.stringify({ error: 'INSTITUTIONAL_MODE' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            });
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
