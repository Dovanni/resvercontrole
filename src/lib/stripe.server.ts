import Stripe from 'stripe';

const STRIPE_RESTRICTED_KEY = process.env['STRIPE_RESTRICTED_KEY'];

/**
 * Stripe client server-only.
 * Rejects live keys to prevent accidental production use during test phase.
 */
export const getStripeClient = () => {
  if (!STRIPE_RESTRICTED_KEY) {
    return null;
  }

  if (STRIPE_RESTRICTED_KEY.startsWith('sk_live_') || STRIPE_RESTRICTED_KEY.startsWith('rk_live_')) {
    console.error('Stripe Live Key detected and rejected in Phase 2A.');
    return null;
  }

  return new Stripe(STRIPE_RESTRICTED_KEY, {
    apiVersion: '2026-07-29.dahlia',
    typescript: true,
  });
};

/**
 * Global webhook handler for Stripe events.
 * Scoped to database integrity and multi-tenant billing logic.
 */
export const handleStripeWebhook = async (event: Stripe.Event) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  
  // Log the event for audit trail
  await supabaseAdmin.from('payment_events').insert({
    provider: 'stripe',
    provider_event_id: event.id,
    event_type: event.type,
    payload: event as any,
    processed: false
  });

  switch (event.type) {
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[STRIPE WEBHOOK] Processing expiration for session: ${session.id}`);
      
      const { error } = await supabaseAdmin.rpc('expire_checkout_attempt', {
        p_provider: 'stripe',
        p_provider_checkout_session_id: session.id
      });

      if (error) {
        console.error(`[STRIPE WEBHOOK] Failed to expire attempt for session ${session.id}:`, error);
        throw error;
      }
      break;
    }
    
    // Add other cases (checkout.session.completed, etc.) as needed for Phase 2B/3
    default:
      console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
  }

  // Mark as processed
  await supabaseAdmin
    .from('payment_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('provider_event_id', event.id);
};
