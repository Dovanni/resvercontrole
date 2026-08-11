import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getBillingContextTransport = async (empresaId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`/api/public/billing/context?empresaId=${empresaId}`, {
    method: 'GET',
    headers: { 
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'BILLING_CONTEXT_FAILED');
  }

  return response.json() as Promise<{
    subscription: {
      status: 'trialing' | 'active' | 'past_due' | 'grace_read_only' | 'restricted' | 'none';
      plan_code: string;
      plan_name: string;
      current_user_count: number;
      current_period_ends_at: string | null;
      days_remaining: number;
    };
    checkout: {
      enabled: boolean;
      environment: 'live' | 'sandbox';
      reason_code: string;
    };
  }>;
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

export const canInviteMemberTransport = async (empresaId: string) => {
  const { data: result, error } = await supabase.rpc("can_company_invite_member", {
    p_empresa_id: empresaId,
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
};

