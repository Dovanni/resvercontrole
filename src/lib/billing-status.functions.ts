import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getCheckoutStatus = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => {
    const req = getRequest();
    const host = req.headers.get('host');
    const origin = req.headers.get('origin');
    
    const CANONICAL_HOST = 'www.vejamais.com.br';
    const ALLOWED_PREVIEW_HOST = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
    const ALLOWED_PREVIEW_ORIGIN = 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
    const CANONICAL_ORIGIN = 'https://www.vejamais.com.br';
    
    const isProduction = host === CANONICAL_HOST;
    const isPreview = host === ALLOWED_PREVIEW_HOST;
    const isAllowedOrigin = origin === ALLOWED_PREVIEW_ORIGIN || origin === CANONICAL_ORIGIN;

    const STRIPE_LIVE_BILLING_ENABLED = process.env['STRIPE_LIVE_BILLING_ENABLED'] === 'true';

    // Business Logic: Production needs live flag, Preview is always enabled for testing
    const checkout_enabled = (isProduction && STRIPE_LIVE_BILLING_ENABLED && isAllowedOrigin) || (isPreview && isAllowedOrigin);
    
    const billing_environment = isProduction ? 'live' : 'sandbox';
    const plan_display_price = 'R$ 35,90/mês';

    let exact_disable_reason = null;
    if (!isAllowedOrigin) exact_disable_reason = 'Unauthorized origin';
    else if (isProduction && !STRIPE_LIVE_BILLING_ENABLED) exact_disable_reason = 'Production checkout disabled';
    else if (!isProduction && !isPreview) exact_disable_reason = 'Unauthorized host';

    return {
      checkout_enabled,
      billing_environment,
      plan_display_price,
      exact_disable_reason
    };
  });
