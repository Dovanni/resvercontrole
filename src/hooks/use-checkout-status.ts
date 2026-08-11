import { useQuery } from "@tanstack/react-query";
import { getCheckoutStatusTransport } from "@/lib/billing.functions";
import { useAuth } from "@/lib/auth";

export function useCheckoutStatus(empresaId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["checkout-status", user?.id, empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      return getCheckoutStatusTransport(empresaId);
    },
    enabled: !!user?.id && !!empresaId,
    staleTime: 1000 * 60, // 1 minute
  });
}
