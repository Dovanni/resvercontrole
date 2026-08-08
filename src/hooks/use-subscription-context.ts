import { useQuery } from "@tanstack/react-query";
import { getCompanySubscriptionContext } from "./billing.functions";
import { useAuth } from "@/hooks/use-auth";

export function useSubscriptionContext(empresaId: string | undefined) {
  const { user } = useAuth();
  const isEnabled = import.meta.env.VITE_ENABLE_BILLING_SUBSCRIPTIONS === 'true';

  return useQuery({
    queryKey: ["subscription-context", user?.id, empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      return getCompanySubscriptionContext({ data: { empresaId } });
    },
    enabled: !!user?.id && !!empresaId && isEnabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
