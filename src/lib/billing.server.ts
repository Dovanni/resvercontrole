import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { isValidOrigin, isAuthorizedHost, getBillingEnvironment } from "./billing-status.server";
import { STAGES, REASON_CODES, classifyError } from "./stripe-observability.server";

export async function getCompanySubscriptionContextImpl(empresaId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const req = getRequest();
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    userId = user?.id || null;
  }

  if (!userId) {
    console.warn("User not authenticated in getCompanySubscriptionContext");
    throw new Error("Unauthorized");
  }

  const { data: context, error } = await supabaseAdmin.rpc("get_company_subscription_context_admin", {
    p_empresa_id: empresaId,
    p_verified_user_id: userId
  });

  if (error) {
    console.error("Error fetching subscription context:", error);
    throw new Error("Failed to fetch subscription context");
  }

  return context as {
    billing_mode?: 'commercial' | 'institutional';
    plan_code: string;
    plan_name: string;
    status: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
    current_period_ends_at: string | null;
    days_remaining: number;
    access_mode: 'full' | 'read_only' | 'billing_export_support_only' | 'billing_only' | 'restricted';
    max_users: number;
    current_user_count: number;
    can_invite_member: boolean;
    priority_suggestions: boolean;
  } | null;
}

export async function createStripeCheckoutSessionImpl(empresaId: string, traceId?: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const trace_id = traceId || crypto.randomUUID();
  let current_stage: keyof typeof STAGES = "REQUEST_VALIDATED";
  const req = getRequest();
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) throw new Error("Unauthorized");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) throw new Error("Unauthorized");

  const { data: membership, error: memberError } = await supabaseAdmin
    .from("user_company_access")
    .select("role")
    .eq("empresa_id", empresaId)
    .eq("user_id", user.id)
    .single();

  if (memberError || !membership || membership.role !== 'admin') {
    throw new Error("Forbidden: Admin access required");
  }

  // Server-side hard boundary: institutional matrix can never create a commercial checkout.
  const { data: company, error: companyError } = await supabaseAdmin
    .from('empresas')
    .select('billing_mode')
    .eq('id', empresaId)
    .single();

  if (companyError || !company) throw new Error("Company not found");
  if (company.billing_mode !== 'commercial') {
    throw new Error("Forbidden: Institutional billing mode");
  }

  const host = req.headers.get('host');
  const origin = req.headers.get('origin');
  const isAuthorized = isAuthorizedHost(host);
  const isAllowedOrigin = isValidOrigin(origin);

  if (!isAuthorized) return { status: 'checkout_disabled', message: 'Unauthorized host' };
  if (!isAllowedOrigin) return { status: 'checkout_disabled', message: 'Unauthorized origin' };

  const billing_env = getBillingEnvironment(host);
  const isProduction = billing_env === 'live';
  const STRIPE_LIVE_CHECKOUT_ENABLED = process.env['STRIPE_LIVE_CHECKOUT_ENABLED'] === 'true';

  if (isProduction && !STRIPE_LIVE_CHECKOUT_ENABLED) {
    return { status: 'checkout_disabled', message: 'Production checkout disabled' };
  }

  // Environment-hardening: never fall back from sandbox to a generic Stripe price.
  const STRIPE_PRICE_ENTERPRISE_MONTHLY = isProduction
    ? process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE']
    : process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_TEST'];

  if (!STRIPE_PRICE_ENTERPRISE_MONTHLY) {
    return { status: 'configuration_pending', message: 'Missing Stripe price' };
  }

  // Environment-hardening: sandbox consumes only *_TEST; live consumes only *_LIVE.
  const STRIPE_KEY = isProduction
    ? process.env['STRIPE_RESTRICTED_KEY_LIVE']
    : process.env['STRIPE_RESTRICTED_KEY_TEST'];

  if (!STRIPE_KEY) {
    throw new Error(JSON.stringify({
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: "STRIPE_CLIENT_CONSTRUCTION_STARTED",
      reason_code: REASON_CODES.STRIPE_CLIENT_KEY_MISSING
    }));
  }

  const { data: sub, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan_id, status, trial_ends_at, stripe_customer_id, stripe_subscription_id, plans(code)')
    .eq('empresa_id', empresaId)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (subError || !sub) throw new Error("Subscription not found");
  if (sub.stripe_subscription_id) {
    throw new Error("Subscription already managed by Stripe");
  }

  current_stage = "RESERVATION_RPC_STARTED";
  const { data: reserveData, error: reserveError } = await supabaseAdmin.rpc('reserve_checkout_attempt', {
    p_empresa_id: empresaId,
    p_subscription_id: sub.id,
    p_verified_user_id: user.id,
    p_livemode: isProduction
  });
  current_stage = "RESERVATION_RPC_RETURNED";

  if (reserveError) {
    const classification = classifyError(reserveError);
    throw new Error(JSON.stringify({
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: current_stage,
      reason_code: classification.reason_code,
      upstream_code: classification.upstream_code,
      upstream_http_status: classification.upstream_http_status
    }));
  }

  const attempt = reserveData as any;
  if (!attempt?.id || !attempt?.status) {
    throw new Error(JSON.stringify({
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: current_stage,
      reason_code: attempt == null ? REASON_CODES.RESERVATION_RPC_RESPONSE_EMPTY : REASON_CODES.RESERVATION_RPC_RESPONSE_INVALID
    }));
  }

  current_stage = "RESERVATION_RESULT_VALIDATED";

  try {
    current_stage = "STRIPE_REQUEST_PREPARED";
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', STRIPE_PRICE_ENTERPRISE_MONTHLY);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${origin}/configuracoes/assinatura?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/configuracoes/assinatura?checkout=cancel`);
    params.append('client_reference_id', attempt.id);
    params.append('locale', 'pt-BR');

    if (sub.stripe_customer_id) params.append('customer', sub.stripe_customer_id);

    // Canonical metadata used by the live webhook and Supabase contract.
    params.append('metadata[attempt_id]', attempt.id);
    params.append('metadata[empresa_id]', empresaId);
    params.append('metadata[subscription_id]', sub.id);
    params.append('metadata[plan_code]', 'enterprise_monthly');
    params.append('subscription_data[metadata][attempt_id]', attempt.id);
    params.append('subscription_data[metadata][empresa_id]', empresaId);
    params.append('subscription_data[metadata][subscription_id]', sub.id);
    params.append('subscription_data[metadata][internal_subscription_id]', sub.id);
    params.append('subscription_data[metadata][plan_code]', 'enterprise_monthly');

    // Preserve the original 30-day company trial. Stripe trial_end requires >=48h.
    // For the final <48h window we use whole remaining days (minimum 1), which can only
    // extend the customer benefit slightly and never charge before the internal trial ends.
    if (sub.status === 'trialing' && sub.trial_ends_at) {
      const trialEndMs = new Date(sub.trial_ends_at).getTime();
      const remainingMs = trialEndMs - Date.now();
      const fortyEightHoursMs = 48 * 60 * 60 * 1000;
      if (remainingMs >= fortyEightHoursMs) {
        params.append('subscription_data[trial_end]', String(Math.floor(trialEndMs / 1000)));
      } else if (remainingMs > 0) {
        params.append('subscription_data[trial_period_days]', String(Math.max(1, Math.ceil(remainingMs / 86400000))));
      }
    }

    current_stage = "STRIPE_TRANSPORT_STARTED";
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': attempt.id
      },
      body: params.toString()
    });

    current_stage = "STRIPE_RESPONSE_RECEIVED";
    const responseBody = await stripeResponse.json();

    if (!stripeResponse.ok) {
      const upstreamStatus = stripeResponse.status;
      const stripeError = responseBody.error || {};
      let reason: keyof typeof REASON_CODES = "STRIPE_REST_TRANSPORT_FAILED";
      if (upstreamStatus === 401) reason = "STRIPE_API_KEY_REJECTED";
      else if (upstreamStatus === 403) reason = "STRIPE_PERMISSION_DENIED";
      else if (upstreamStatus === 429) reason = "STRIPE_RATE_LIMITED";
      else if (upstreamStatus >= 500) reason = "STRIPE_UPSTREAM_FAILURE";
      else if (stripeError.code === 'resource_missing') reason = "STRIPE_PRICE_OR_RESOURCE_INVALID";
      throw {
        __isStripeRestError: true,
        reason_code: reason,
        upstream_http_status: upstreamStatus,
        upstream_code: stripeError.code || stripeError.type,
        upstream_param: stripeError.param
      };
    }

    const session = responseBody;
    if (!session.id || !session.url || !session.url.startsWith('https://checkout.stripe.com/')) {
      throw new Error("INVALID_STRIPE_SESSION_RESPONSE");
    }
    if (isProduction && !session.livemode) throw new Error("SANDBOX_SESSION_IN_PRODUCTION_BOUNDARY");
    if (!isProduction && session.livemode) throw new Error("LIVE_SESSION_IN_SANDBOX_BOUNDARY");

    current_stage = "STRIPE_CHECKOUT_STARTED";
    const { data: finalizeData, error: finalizeError } = await supabaseAdmin.rpc('finalize_checkout_attempt_v2', {
      p_attempt_id: attempt.id,
      p_provider: 'stripe',
      p_provider_checkout_session_id: session.id,
      p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    });

    if (finalizeError) throw new Error('CHECKOUT_PERSISTENCE_FAILED');
    const finalizeResult = finalizeData as { persisted?: boolean } | null;
    if (!finalizeResult?.persisted) throw new Error('CHECKOUT_PERSISTENCE_NOT_CONFIRMED');

    current_stage = "HTTP_RESPONSE_CREATED";
    return {
      trace_id,
      stage: current_stage,
      url: session.url,
      sessionId: session.id,
      environment: isProduction ? 'live' : 'sandbox',
      canonical_quantity: 1,
      item_count: 1
    };
  } catch (error: any) {
    const classification = classifyError(error);
    const isPreTransport =
      (current_stage as string) === "STRIPE_CLIENT_CONSTRUCTION_STARTED" ||
      (current_stage as string) === "STRIPE_CLIENT_CONSTRUCTED" ||
      (current_stage as string) === "STRIPE_REQUEST_PREPARED";

    if (isPreTransport && classification.reason_code && attempt?.id) {
      try {
        await (supabaseAdmin.rpc as any)('fail_checkout_attempt_initialization', {
          p_attempt_id: attempt.id,
          p_empresa_id: empresaId,
          p_subscription_id: sub.id,
          p_livemode: isProduction,
          p_expected_updated_at: attempt.updated_at,
          p_reason_code: classification.reason_code
        });
      } catch (recoveryErr) {
        console.error("Critical: Pre-transport recovery RPC failed:", recoveryErr);
      }
    }

    throw new Error(JSON.stringify({
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: current_stage,
      reason_code: classification.reason_code,
      upstream_code: classification.upstream_code,
      upstream_http_status: classification.upstream_http_status,
      upstream_param: classification.upstream_param
    }));
  }
}
