import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getRequest } from "@tanstack/react-start/server";

export const getCompanySubscriptionContext = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    // Usar o cliente administrativo para a RPC que internamente usa auth.uid()
    // Como a RPC usa auth.uid(), precisamos garantir que o contexto do Supabase saiba quem é o usuário.
    // O cliente admin não preenche auth.uid() automaticamente do token, ele ignora RLS.
    // Mas a nossa RPC FOI desenhada para usar auth.uid().
    
    // CORREÇÃO: Vamos emular o comportamento da RPC mas usando o cliente admin para garantir bypass de ACLs de tabela
    // e validando o membership manualmente aqui se necessário, ou ajustando a RPC para aceitar o user_id.

    const { data: context, error } = await supabaseAdmin.rpc("get_company_subscription_context", {
      p_empresa_id: data.empresaId,
      p_user_id: userId
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
