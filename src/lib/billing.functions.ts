import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getCompanySubscriptionContext = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: context, error } = await supabase.rpc("get_company_subscription_context", {
      p_empresa_id: data.empresaId,
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
