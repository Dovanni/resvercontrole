import { z } from "zod";
import { getStripeClient } from "./stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { isValidOrigin, isAuthorizedHost, getBillingEnvironment } from "./billing-status.server";
import { STAGES, REASON_CODES, classifyError } from "./stripe-observability.server";

export async function getCompanySubscriptionContextImpl(empresaId: string) {
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

  // Chamar a RPC administrativa estrita
  const { data: context, error } = await supabaseAdmin.rpc("get_company_subscription_context_admin", {
    p_empresa_id: empresaId,
    p_verified_user_id: userId
  });

  if (error) {
    console.error("Error fetching subscription context:", error);
    throw new Error("Failed to fetch subscription context");
  }

  return context as {
    plan_code: string;
    plan_name: string;
    status: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
    current_period_ends_at: string | null;
    days_remaining: number;
    access_mode: 'full' | 'read_only' | 'billing_export_support_only' | 'billing_only';
    max_users: number;
    current_user_count: number;
    can_invite_member: boolean;
    priority_suggestions: boolean;
  } | null;
}

export async function createStripeCheckoutSessionImpl(empresaId: string, traceId?: string) {
  const trace_id = traceId || crypto.randomUUID();
  let current_stage: keyof typeof STAGES = "REQUEST_VALIDATED";
  const req = getRequest();
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) throw new Error("Unauthorized");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) throw new Error("Unauthorized");

  // Validar membership admin na empresa
  const { data: membership, error: memberError } = await supabaseAdmin
    .from("user_company_access")
    .select("role")
    .eq("empresa_id", empresaId)
    .eq("user_id", user.id)
    .single();

  if (memberError || !membership || membership.role !== 'admin') {
    throw new Error("Forbidden: Admin access required");
  }

  const host = req.headers.get('host');
  const origin = req.headers.get('origin');
  
  const isAuthorized = isAuthorizedHost(host);
  const isAllowedOrigin = isValidOrigin(origin);

  if (!isAuthorized) {
    console.warn(`Unauthorized host blocked: Host=${host}`);
    return { status: 'checkout_disabled', message: 'Unauthorized host' };
  }

  if (!isAllowedOrigin) {
    console.warn(`Unauthorized origin blocked: Origin=${origin}`);
    return { status: 'checkout_disabled', message: 'Unauthorized origin' };
  }

  const billing_env = getBillingEnvironment(host);
  const isProduction = billing_env === 'live';

  const STRIPE_LIVE_BILLING_ENABLED = process.env['STRIPE_LIVE_BILLING_ENABLED'] === 'true';

  if (isProduction && !STRIPE_LIVE_BILLING_ENABLED) {
    console.warn("Production checkout is globally disabled via STRIPE_LIVE_BILLING_ENABLED");
    return { status: 'checkout_disabled', message: 'Production checkout disabled' };
  }

  const STRIPE_PRICE_ENTERPRISE_MONTHLY = isProduction
    ? process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE']
    : (process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_TEST'] || process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY']);

  if (!STRIPE_PRICE_ENTERPRISE_MONTHLY) {
    console.warn("Stripe configuration pending (Missing prices)");
    return { status: 'configuration_pending' };
  }

  // Resolve subscription and reserve checkout attempt
  const { data: sub, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan_id, stripe_customer_id, plans(code)')
    .eq('empresa_id', empresaId)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (subError || !sub) {
    throw new Error("Subscription not found");
  }

  // Atomic reservation with environment isolation
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
    const sanitizedError = {
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: current_stage,
      reason_code: classification.reason_code,
      upstream_code: classification.upstream_code,
      upstream_http_status: classification.upstream_http_status
    };
    throw new Error(JSON.stringify(sanitizedError));
  }

  if (reserveData == null) {
    const sanitizedError = {
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: current_stage,
      reason_code: REASON_CODES.RESERVATION_RPC_RESPONSE_EMPTY,
      upstream_code: null,
      upstream_http_status: null
    };
    throw new Error(JSON.stringify(sanitizedError));
  }

  const attempt = reserveData as any;
  if (!attempt.id || !attempt.status) {
    const sanitizedError = {
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: current_stage,
      reason_code: REASON_CODES.RESERVATION_RPC_RESPONSE_INVALID,
      upstream_code: null,
      upstream_http_status: null
    };
    throw new Error(JSON.stringify(sanitizedError));
  }

  current_stage = "RESERVATION_RESULT_VALIDATED";

  try {
    current_stage = "STRIPE_CLIENT_CONSTRUCTION_STARTED";
    const stripe = getStripeClient(isProduction);
    current_stage = "STRIPE_CLIENT_CONSTRUCTED";

    // ETAPA 3: Retomada ou Nova Sessão
    if (attempt.status === 'open' && attempt.provider_checkout_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(attempt.provider_checkout_session_id);
        
        // Invariantes Sandbox/Live (Sandbox domain can only use test keys, Live domain only live keys)
        if (isProduction !== existingSession.livemode) throw new Error("LIVEMODE_REJECTION");
        if (existingSession.status !== 'open') throw new Error("SESSION_EXPIRED_OR_COMPLETED");
        if (existingSession.payment_status !== 'unpaid') throw new Error("PAYMENT_ALREADY_PROCESSED");

        // Invariantes Financeiros e Metadados
        const sessionMetadata = existingSession.metadata || {};
        if (sessionMetadata.empresa_id !== empresaId || sessionMetadata.subscription_id !== sub.id) {
          throw new Error("SESSION_METADATA_MISMATCH");
        }

        return {
          status: 'session_created',
          checkoutUrl: existingSession.url,
          sessionId: existingSession.id,
          canonical_quantity: 1,
          item_count: 1
        };
      } catch (e) {
        console.error("Failed to resume session:", e);
        throw new Error("CHECKOUT_RESUME_FAILED");
      }
    }

    if (attempt.status === 'open' && !attempt.provider_checkout_session_id) {
      throw new Error("CHECKOUT_RECONCILIATION_REQUIRED");
    }

    const successUrl = `${origin}/configuracoes/assinatura?checkout=success`;
    const cancelUrl = `${origin}/configuracoes/assinatura?checkout=cancel`;

    current_stage = "STRIPE_REQUEST_PREPARED";
    current_stage = "STRIPE_TRANSPORT_STARTED";
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price: STRIPE_PRICE_ENTERPRISE_MONTHLY,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: sub.stripe_customer_id || undefined,
      metadata: {
        empresa_id: empresaId,
        internal_subscription_id: sub.id,
        plan_code: 'enterprise_monthly',
        attempt_id: attempt.id
      },
      subscription_data: {
        metadata: {
          empresa_id: empresaId,
          internal_subscription_id: sub.id,
          plan_code: 'enterprise_monthly'
        }
      }
    }, {
      idempotencyKey: attempt.idempotency_key
    });

    current_stage = "STRIPE_RESPONSE_RECEIVED";
    current_stage = "STRIPE_CHECKOUT_STARTED";

    const { data: finalizeData, error: finalizeError } = await supabaseAdmin.rpc('finalize_checkout_attempt_v2', {
      p_attempt_id: attempt.id,
      p_provider: 'stripe',
      p_provider_checkout_session_id: session.id,
      p_expires_at: new Date(session.expires_at * 1000).toISOString()
    });

    if (finalizeError) {
      console.error("RPC Error in finalize_checkout_attempt_v2:", finalizeError);
      throw new Error('CHECKOUT_PERSISTENCE_FAILED');
    }

    const finalizeResult = finalizeData as { persisted?: boolean } | null;
    if (!finalizeResult?.persisted) {
      throw new Error('CHECKOUT_PERSISTENCE_NOT_CONFIRMED');
    }

    current_stage = "HTTP_RESPONSE_CREATED";
    return { 
      trace_id,
      stage: current_stage,
      checkoutUrl: session.url,
      sessionId: session.id,
      canonical_quantity: 1,
      item_count: 1
    };
  } catch (error: any) {
    const classification = classifyError(error);
    const sanitizedError = {
      error: "CHECKOUT_INITIALIZATION_FAILED",
      contract_version: "reservation-observability-v2",
      trace_id,
      stage: current_stage,
      reason_code: classification.reason_code,
      upstream_code: classification.upstream_code,
      upstream_http_status: classification.upstream_http_status
    };
    throw new Error(JSON.stringify(sanitizedError));
  }
}
