import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  getCompanySubscriptionContextImpl,
  createStripeCheckoutSessionImpl,
} from "./billing.server";

// getCompanySubscriptionContext is kept for internal use but not for checkout flow
export const getCompanySubscriptionContext = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => {
    return getCompanySubscriptionContextImpl(data.empresaId);
  });

export const getCheckoutStatusTransport = async (empresaId: string) => {
  const response = await fetch(`/api/public/billing/checkout-status?empresaId=${empresaId}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch status');
  }
  return response.json();
};

export const createStripeCheckoutSession = async (empresaId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  const response = await fetch('/api/public/billing/create-checkout', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ empresaId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout');
  }
  return response.json();
};

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
