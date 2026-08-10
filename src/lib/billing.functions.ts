import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getCompanySubscriptionContext = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => {
    const { getCompanySubscriptionContextImpl } = await import("./billing.server");
    return getCompanySubscriptionContextImpl(data.empresaId);
  });

export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => {
    const { createStripeCheckoutSessionImpl } = await import("./billing.server");
    return createStripeCheckoutSessionImpl(data.empresaId);
  });

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
