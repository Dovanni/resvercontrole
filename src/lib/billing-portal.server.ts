import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/integrations/supabase/client.server';
import { getStripeClient } from './stripe.server';

export async function createStripePortalSessionImpl(empresaId: string, origin: string, host: string | null) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: sub, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, status')
    .eq('empresa_id', empresaId)
    .single();

  if (subError || !sub || !sub.stripe_customer_id) {
    console.error(`[PortalSession] Customer ID not found for company ${empresaId}`);
    throw new Error('CUSTOMER_NOT_FOUND');
  }

  const isProduction = host === 'www.vejamais.com.br' || host === 'vejamais.com.br';
  const stripeKey = isProduction 
    ? process.env['STRIPE_RESTRICTED_KEY_LIVE'] 
    : (process.env['STRIPE_RESTRICTED_KEY_TEST'] || process.env['STRIPE_RESTRICTED_KEY']);

  if (!stripeKey) {
    console.error(`[PortalSession] Stripe key missing for production=${isProduction}`);
    throw new Error('STRIPE_CONFIG_MISSING');
  }

  const returnUrl = `https://www.vejamais.com.br/configuracoes/assinatura`;

  try {
    const params = new URLSearchParams();
    params.append('customer', sub.stripe_customer_id);
    params.append('return_url', returnUrl);

    console.log(`[PortalSession] Creating session for customer ${sub.stripe_customer_id} on ${isProduction ? 'LIVE' : 'TEST'}`);

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2025-01-27.acacia'
      },
      body: params.toString()
    });

    const session = await response.json() as any;

    if (!response.ok) {
      console.error('[PortalSession] Stripe API Error (REST):', session);
      throw new Error(session.error?.message || 'STRIPE_PORTAL_ERROR');
    }

    if (!session.url) {
      console.error('[PortalSession] Stripe response missing URL:', session);
      throw new Error('STRIPE_RESPONSE_INVALID');
    }

    return { url: session.url };
  } catch (err: any) {
    console.error('[PortalSession] Failure:', err);
    throw err;
  }
}
