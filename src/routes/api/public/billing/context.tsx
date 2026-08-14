import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { getCheckoutStatusImpl } from '@/lib/billing-status.server';
import { getCompanySubscriptionContextImpl } from '@/lib/billing.server';

const contextQuerySchema = z.object({
  empresaId: z.string().uuid(),
});

export const Route = createFileRoute('/api/public/billing/context')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const params = contextQuerySchema.safeParse(Object.fromEntries(url.searchParams));

          if (!params.success) {
            return new Response(JSON.stringify({ error: 'INVALID_EMPRESA_ID' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const { empresaId } = params.data;
          const authHeader = request.headers.get('Authorization');
          const token = authHeader?.replace('Bearer ', '');

          if (!token) {
            return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !user) {
            return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Validar acesso à empresa (Membership)
          const { data: membership, error: memberError } = await supabaseAdmin
            .from('user_company_access')
            .select('role')
            .eq('empresa_id', empresaId)
            .eq('user_id', user.id)
            .single();

          if (memberError || !membership) {
            return new Response(JSON.stringify({ error: 'COMPANY_ACCESS_DENIED' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const host = request.headers.get('host');
          const origin = request.headers.get('origin') || request.headers.get('referer');

          // Consulta atômica de assinatura e status de checkout
          const [subContext, checkoutStatus] = await Promise.all([
            getCompanySubscriptionContextImpl(empresaId),
            getCheckoutStatusImpl(empresaId, host, origin)
          ]);

          if (!subContext) {
            return new Response(JSON.stringify({ error: 'SUBSCRIPTION_NOT_FOUND' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Identificação Institucional Segura (Server-side canonical authority)
          // ID da Matriz autorizado para modo administrativo institucional
          const INSTITUTIONAL_MATRIX_IDS = [
            'c610705d-e900-4b6f-8460-1a0633b7962a',
            '55bdfa1d-263d-4099-b2f9-35dea74719f7'
          ];
          const isInstitutional = INSTITUTIONAL_MATRIX_IDS.includes(empresaId);

          const responseData = {
            subscription: {
              status: subContext.status,
              plan_code: subContext.plan_code,
              plan_name: subContext.plan_name,
              current_user_count: subContext.current_user_count,
              current_period_ends_at: subContext.current_period_ends_at,
              days_remaining: subContext.days_remaining,
              trial_ends_at: subContext.trial_ends_at
            },
            checkout: {
              enabled: isInstitutional ? false : checkoutStatus.checkout_enabled,
              environment: checkoutStatus.billing_environment,
              reason_code: isInstitutional ? 'INSTITUTIONAL_MODE' : (checkoutStatus.exact_disable_reason || 'READY')
            },
            billing_mode: isInstitutional ? 'institutional' : 'commercial'
          };

          return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'private, no-store'
            }
          });

        } catch (error) {
          console.error('[BillingContext] Failure:', error);
          return new Response(JSON.stringify({ error: 'BILLING_CONTEXT_FAILED' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
  }
});
