import Stripe from 'stripe';

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_EVENT_OBJECT_DEFENSIVE_GUARD_TARGETED_CORRECTION
 * Validação rigorosa do contrato do objeto de checkout sem asserções inseguras.
 */
export function validateCheckoutSessionContract(data: unknown): data is Stripe.Checkout.Session {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  // Validar ID
  if (typeof obj.id !== 'string' || !obj.id.startsWith('cs_') || obj.id.length < 5) {
    return false;
  }
  
  // Validar que é um objeto de checkout.session (contrato mínimo exigido pela RPC)
  if (obj.object !== 'checkout.session') {
    return false;
  }
  
  return true;
}
