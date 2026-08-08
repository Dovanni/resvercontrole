import { useQuery } from "@tanstack/react-query";
import { getCompanySubscriptionContext } from "@/lib/billing.functions";
import { useAuth } from "@/lib/auth";

export function useSubscriptionContext(empresaId: string | undefined) {
  const { user } = useAuth();
  const isEnabled = import.meta.env.VITE_ENABLE_BILLING_SUBSCRIPTIONS === 'true';

  return useQuery({
    queryKey: ["subscription-context", user?.id, empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      try {
        console.log("Calling getCompanySubscriptionContext for empresa:", empresaId);
        const result = await getCompanySubscriptionContext({ data: { empresaId } });
        console.log("Subscription context result:", result);
        return result;
      } catch (err) {
        console.error("Critical error in getCompanySubscriptionContext server fn call:", err);
        throw err;
      }
    },
    enabled: !!user?.id && !!empresaId && isEnabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
