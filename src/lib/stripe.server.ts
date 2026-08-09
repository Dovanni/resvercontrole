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
