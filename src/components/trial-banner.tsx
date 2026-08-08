import React from "react";
import { useSubscriptionContext } from "@/hooks/use-subscription-context";
import { AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMultiempresa } from "@/hooks/use-multiempresa";

export function TrialBanner() {
  const { empresaId } = useMultiempresa();
  const { data: sub, isLoading } = useSubscriptionContext(empresaId);

  if (isLoading || !sub || sub.status !== "trialing") {
    return null;
  }

  const daysLeft = sub.days_remaining;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-2 text-primary font-medium">
        <AlertCircle className="size-4 shrink-0" />
        <span>
          Você está no período de avaliação do <strong>{sub.plan_name}</strong>. 
          Restam <strong>{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</strong>.
        </span>
      </div>
      <Button variant="link" size="sm" className="h-7 text-primary font-semibold hover:no-underline p-0 flex items-center gap-1.5" asChild>
        <a href="/assinatura">
          <CreditCard className="size-3.5" />
          <span>Assinar Agora</span>
        </a>
      </Button>
    </div>
  );
}
