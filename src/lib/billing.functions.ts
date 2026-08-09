import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getCompanySubscriptionContext = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }: { data: { empresaId: string } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const authHeader = req?.headers.get("Authorization");
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
      p_empresa_id: data.empresaId,
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
  });

export const createStripeCheckoutSessionHandler = async ({ data }: { data: { empresaId: string } }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const authHeader = req?.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) throw new Error("Unauthorized");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) throw new Error("Unauthorized");

  // Validar membership admin na empresa
  const { data: membership, error: memberError } = await supabaseAdmin
    .from("user_company_access")
    .select("role")
    .eq("empresa_id", data.empresaId)
    .eq("user_id", user.id)
    .single();

  if (memberError || !membership || membership.role !== 'admin') {
    throw new Error("Forbidden: Admin access required");
  }

  const host = req.headers.get('host');
  const origin = req.headers.get('origin');
  
  const ALLOWED_PREVIEW_HOST = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
  const ALLOWED_PREVIEW_ORIGIN = 'https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
  
  if (host !== ALLOWED_PREVIEW_HOST || origin !== ALLOWED_PREVIEW_ORIGIN) {
    console.warn(`Unauthorized host/origin blocked: Host=${host}, Origin=${origin}`);
    return { 
      status: 'checkout_disabled', 
      message: 'Production checkout is disabled',
      evidence: { host_match: host === ALLOWED_PREVIEW_HOST, origin_match: origin === ALLOWED_PREVIEW_ORIGIN }
    };
  }

  const STRIPE_RESTRICTED_KEY = process.env['STRIPE_RESTRICTED_KEY'];
  const STRIPE_PRICE_ENTERPRISE_MONTHLY = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'];

  if (!STRIPE_RESTRICTED_KEY || !STRIPE_PRICE_ENTERPRISE_MONTHLY) {
    console.warn("Stripe configuration pending (Missing secrets)");
    return { status: 'configuration_pending' };
  }

  // Resolve subscription and reserve checkout attempt
  const { data: sub, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan_id, stripe_customer_id, plans(code)')
    .eq('empresa_id', data.empresaId)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (subError || !sub) {
    throw new Error("Subscription not found");
  }

  // Atomic reservation
  const { data: attempt, error: reserveError } = await supabaseAdmin.rpc('reserve_checkout_attempt', {
    p_empresa_id: data.empresaId,
    p_subscription_id: sub.id,
    p_verified_user_id: user.id
  });

  if (reserveError || !attempt) {
    console.error("Failed to reserve checkout attempt:", reserveError);
    throw new Error("Checkout session busy or failed to initialize");
  }

  const { getStripeClient } = await import("@/lib/stripe.server");
  const stripe = getStripeClient();

  if (!stripe) {
    console.error("Stripe client initialization failed");
    throw new Error("Payment service unavailable");
  }

  // ETAPA 3: Retomada ou Nova Sessão
  if (attempt.status === 'open' && attempt.provider_checkout_session_id) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(attempt.provider_checkout_session_id);
      
      // Invariantes Sandbox
      if (existingSession.livemode) throw new Error("LIVEMODE_REJECTION");
      if (existingSession.status !== 'open') throw new Error("SESSION_EXPIRED_OR_COMPLETED");
      if (existingSession.payment_status !== 'unpaid') throw new Error("PAYMENT_ALREADY_PROCESSED");

      // Invariantes Financeiros e Metadados
      const sessionMetadata = existingSession.metadata || {};
      if (sessionMetadata.empresa_id !== data.empresaId || sessionMetadata.subscription_id !== sub.id) {
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

  const successUrl = `https://${ALLOWED_PREVIEW_HOST}/configuracoes/assinatura?checkout=success`;
  const cancelUrl = `https://${ALLOWED_PREVIEW_HOST}/configuracoes/assinatura?checkout=cancel`;

  try {
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
        empresa_id: data.empresaId,
        subscription_id: sub.id,
        plan_code: 'enterprise_monthly',
        attempt_id: attempt.id
      },
      subscription_data: {
        metadata: {
          empresa_id: data.empresaId,
          subscription_id: sub.id,
          plan_code: 'enterprise_monthly'
        }
      }
    }, {
      idempotencyKey: attempt.idempotency_key
    });

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

    return { 
      status: 'session_created',
      checkoutUrl: session.url,
      sessionId: session.id,
      canonical_quantity: 1,
      item_count: 1
    };
  } catch (stripeError) {
    console.error("Stripe Session Creation Error:", stripeError);
    throw new Error("Failed to create checkout session");
  }
};

export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => createStripeCheckoutSessionHandler({ data }));


export const canInviteMember = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ empresaId: z.string().uuid() }).parse(data))
  .handler(async ({ data }: { data: { empresaId: string } }) => {
    const { data: result, error } = await supabase.rpc("can_company_invite_member", {
      p_empresa_id: data.empresaId,
    });

    if (error) {
      console.error("Error checking invite permission:", error);
      throw new Error("Failed to check invite permission");
    }

    return result as {
      allowed: boolean;
      current?: number;
      limit?: number;
      message: string;
    };
  });

