import Stripe from 'stripe';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { getStripeClient } from './stripe.server';

export async function createStripePortalSessionImpl(empresaId: string, origin: string, host: string | null) {
  // 1. Obter informações da empresa e do cliente Stripe
  const { data: sub, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, status')
    .eq('empresa_id', empresaId)
    .single();

  if (subError || !sub || !sub.stripe_customer_id) {
    console.error(`[PortalSession] Customer ID not found for company ${empresaId}`);
    throw new Error('CUSTOMER_NOT_FOUND');
  }

  // 2. Identificar ambiente (Sandbox/Live)
  const isProduction = host === 'www.vejamais.com.br' || host === 'vejamais.com.br';
  
  // 3. Obter chave correta
  const stripeKey = isProduction 
    ? process.env['STRIPE_RESTRICTED_KEY_LIVE'] 
    : (process.env['STRIPE_RESTRICTED_KEY_TEST'] || process.env['STRIPE_RESTRICTED_KEY']);

  if (!stripeKey) {
    throw new Error('STRIPE_CONFIG_MISSING');
  }

  // 4. Inicializar Stripe com a chave específica do ambiente
  const stripe = new Stripe(stripeKey, {
    apiVersion: '2025-01-27.acacia' as any, // Versão estável
    httpClient: Stripe.createFetchHttpClient(),
  });

  // 5. Criar a sessão do portal
  const returnUrl = `${origin}/configuracoes/assinatura`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    });

    return { url: session.url };
  } catch (err) {
    console.error('[PortalSession] Stripe API Error:', err);
    throw new Error('STRIPE_PORTAL_ERROR');
  }
}
