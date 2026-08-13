import Stripe from 'stripe';
/**
 * Stripe client server-only.
 * Production-ready gate with explicit environment validation and sanitized errors.
 */
export const getStripeClient = (livemode = false) => {
    const STRIPE_RESTRICTED_KEY = process.env['STRIPE_RESTRICTED_KEY'];
    if (!STRIPE_RESTRICTED_KEY) {
        const err = new Error('Stripe key is missing');
        err.__isStripeClientError = true;
        err.reason_code = 'STRIPE_CLIENT_KEY_MISSING';
        throw err;
    }
    const isLiveKey = STRIPE_RESTRICTED_KEY.startsWith('sk_live_') || STRIPE_RESTRICTED_KEY.startsWith('rk_live_');
    const isTestKey = STRIPE_RESTRICTED_KEY.startsWith('sk_test_') || STRIPE_RESTRICTED_KEY.startsWith('rk_test_');
    // Format validation
    if (!isLiveKey && !isTestKey) {
        const err = new Error('Invalid Stripe key format');
        err.__isStripeClientError = true;
        err.reason_code = 'STRIPE_CLIENT_KEY_FORMAT_INVALID';
        throw err;
    }
    // Environment mismatch validation
    if (livemode && !isLiveKey) {
        const err = new Error('Attempting live checkout with non-live key');
        err.__isStripeClientError = true;
        err.reason_code = 'STRIPE_CLIENT_KEY_MODE_MISMATCH';
        throw err;
    }
    if (!livemode && isLiveKey) {
        const err = new Error('Attempting test/sandbox checkout with live key');
        err.__isStripeClientError = true;
        err.reason_code = 'STRIPE_CLIENT_KEY_MODE_MISMATCH';
        throw err;
    }
    try {
        return new Stripe(STRIPE_RESTRICTED_KEY, {
            apiVersion: '2026-07-29.dahlia',
            typescript: true,
        });
    }
    catch (error) {
        const err = new Error('Failed to construct Stripe client');
        err.__isStripeClientError = true;
        err.reason_code = 'STRIPE_CLIENT_CONSTRUCTION_FAILED';
        throw err;
    }
};
/**
 * Global webhook handler for Stripe events.
 * Scoped to database integrity and multi-tenant billing logic.
 */
export const handleStripeWebhook = async (event) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Log the event for audit trail
    await supabaseAdmin.from('payment_events').insert({
        provider: 'stripe',
        provider_event_id: event.id,
        event_type: event.type,
        payload_sha256: 'pending',
        processed: false
    });
    switch (event.type) {
        case 'checkout.session.expired': {
            const session = event.data.object;
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
        default:
            console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }
    // Mark as processed
    await supabaseAdmin
        .from('payment_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('provider_event_id', event.id);
};
