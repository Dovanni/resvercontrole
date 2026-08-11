import { useBillingContext } from "./use-subscription-context";

export function useCheckoutStatus(empresaId: string | undefined) {
  const { data: context } = useBillingContext(empresaId);
  return { data: context?.checkout };
}

