import { useQuery } from "@tanstack/react-query";
import { getBillingContextTransport } from "@/lib/billing.functions";
import { useAuth } from "@/lib/auth";

export function useBillingContext(empresaId: string | undefined) {
  const { user } = useAuth();
  const isEnabled = import.meta.env.VITE_ENABLE_BILLING_SUBSCRIPTIONS === 'true';

  return useQuery({
    queryKey: ["billing-context", user?.id, empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      return getBillingContextTransport(empresaId);
    },
    enabled: !!user?.id && !!empresaId && isEnabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

