import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getRequest } from "@tanstack/react-start/server";

export const getCompanySubscriptionContext = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => {
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

export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => {
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

    // Hostname/Origin Guard - Strict validation
    const host = req.headers.get('host');
    const origin = req.headers.get('origin');
    const AUTHORIZED_HOSTNAME = 'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app';
    
    if (host !== AUTHORIZED_HOSTNAME) {
      console.warn(`Unauthorized host blocked: ${host}`);
      return { status: 'checkout_disabled', message: 'Production checkout is disabled' };
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
      p_user_id: user.id
    });

    if (reserveError || !attempt) {
      console.error("Failed to reserve checkout attempt:", reserveError);
      throw new Error("Checkout session busy or failed to initialize");
    }

    // Preparation for Stripe Call (Mocked in Phase 2B as per protocol)
    // The actual call will be enabled after human authorization.
    // We reuse the attempt's idempotency_key for Stripe session creation.
    
    const successUrl = `${origin || `https://${host}`}/configuracoes/assinatura?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin || `https://${host}`}/configuracoes/assinatura`;

    return { 
      status: 'ready_for_authorization',
      message: 'Checkout infrastructure prepared and attempt reserved.',
      attemptId: attempt.id,
      idempotencyKey: attempt.idempotency_key,
      mockSessionUrl: successUrl.replace('{CHECKOUT_SESSION_ID}', 'mock_session_id')
    };
  });


export const canInviteMember = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
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

