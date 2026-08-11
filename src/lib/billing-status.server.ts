import { z } from "zod";

const CANONICAL_HOST = 'www.vejamais.com.br';
const APEX_HOST = 'vejamais.com.br';
const ALLOWED_PREVIEW_HOST = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';

const ALLOWED_PREVIEW_ORIGIN = 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
const CANONICAL_WWW_ORIGIN = 'https://www.vejamais.com.br';
const CANONICAL_APEX_ORIGIN = 'https://vejamais.com.br';

/**
 * Normaliza e valida rigorosamente a origem da requisição.
 * @param origin Header 'origin' ou 'referer' processado.
 * @returns boolean indicando se a origem é permitida.
 */
export function isValidOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  try {
    const url = new URL(origin);
    // Protocolo HTTPS obrigatório em produção
    if (url.protocol !== 'https:') {
      // Permitir http apenas se for localhost em desenvolvimento
      if (url.hostname !== 'localhost') return false;
    }

    const normalizedOrigin = url.origin.toLowerCase();
    
    // Comparação exata com allowlist
    const allowlist = [
      CANONICAL_WWW_ORIGIN,
      CANONICAL_APEX_ORIGIN,
      ALLOWED_PREVIEW_ORIGIN
    ];

    return allowlist.includes(normalizedOrigin);
  } catch (e) {
    return false;
  }
}

/**
 * Verifica se o host é autorizado.
 */
export function isAuthorizedHost(host: string | null): boolean {
  if (!host) return false;
  const normalizedHost = host.toLowerCase();
  return normalizedHost === CANONICAL_HOST || 
         normalizedHost === APEX_HOST || 
         normalizedHost === ALLOWED_PREVIEW_HOST;
}

/**
 * Identifica o ambiente de faturamento baseado no host.
 */
export function getBillingEnvironment(host: string | null): 'live' | 'sandbox' {
  if (!host) return 'sandbox';
  const normalizedHost = host.toLowerCase();
  return (normalizedHost === CANONICAL_HOST || normalizedHost === APEX_HOST) ? 'live' : 'sandbox';
}

export async function getCheckoutStatusImpl(empresaId: string, host: string | null, origin: string | null) {
  const normalizedHost = host?.toLowerCase();
  
  const isProduction = normalizedHost === CANONICAL_HOST || normalizedHost === APEX_HOST;
  const isPreview = normalizedHost === ALLOWED_PREVIEW_HOST;
  
  const isAllowedOrigin = origin ? isValidOrigin(origin) : isAuthorizedHost(host);

  const STRIPE_LIVE_BILLING_ENABLED = process.env['STRIPE_LIVE_BILLING_ENABLED'] === 'true';

  // Business Logic: Production needs live flag, Preview is always enabled for testing
  const checkout_enabled = (isProduction && STRIPE_LIVE_BILLING_ENABLED && isAllowedOrigin) || (isPreview && isAllowedOrigin);
  
  const billing_environment = isProduction ? 'live' : 'sandbox';
  const plan_display_price = 'R$ 35,90/mês';

  let exact_disable_reason = null;
  if (!isAllowedOrigin) {
    exact_disable_reason = 'Unauthorized origin';
    // Log sanitizado para diagnóstico (sem PII)
    console.warn(`[getCheckoutStatusImpl] Blocked: host=${host}, origin=${origin}, isProduction=${isProduction}, isPreview=${isPreview}`);
  }
  else if (isProduction && !STRIPE_LIVE_BILLING_ENABLED) exact_disable_reason = 'Production checkout disabled';
  else if (!isProduction && !isPreview) exact_disable_reason = 'Unauthorized host';

  return {
    checkout_enabled,
    billing_environment,
    plan_display_price,
    exact_disable_reason
  };
}
