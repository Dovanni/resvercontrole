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

    // Validar se o usuário é admin da empresa
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("user_company_access")
      .select("role")
      .eq("empresa_id", data.empresaId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || membership.role !== 'admin') {
      throw new Error("Forbidden: Admin access required");
    }

    const STRIPE_RESTRICTED_KEY = process.env['STRIPE_RESTRICTED_KEY'];
    const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
    const STRIPE_PRICE_ENTERPRISE_MONTHLY = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'];

    // Fail-closed: se as chaves não estiverem configuradas, não prossegue
    if (!STRIPE_RESTRICTED_KEY || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_ENTERPRISE_MONTHLY) {
      console.warn("Stripe configuration pending (Missing secrets)");
      return { status: 'configuration_pending' };
    }

    // Feature Flag Guard
    const ENABLE_STRIPE = process.env['VITE_ENABLE_STRIPE_CHECKOUT'] === 'true';
    const isPreview = req.headers.get('host')?.includes('lovable.app');
    
    if (!ENABLE_STRIPE && !isPreview) {
      return { status: 'checkout_disabled' };
    }

    // Fase 2A: NÃO chamar Stripe. Apenas retornar status de preparação.
    return { 
      status: 'ready_for_test',
      message: 'Infrastructure ready. Stripe call bypassed in Phase 2A.'
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

