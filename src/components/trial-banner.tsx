import React, { useState, useEffect } from "react";
import { useSubscriptionContext } from "@/hooks/use-subscription-context";
import { AlertCircle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ALLOWED_PREVIEW_HOSTNAMES = [
  "id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app",
  "localhost",
  "127.0.0.1",
];

const BLOCKED_PRODUCTION_HOSTNAMES = [
  "resvercontrole.lovable.app",
  "vejamais.com.br",
  "www.vejamais.com.br",
];

export function TrialBanner() {
  const { user } = useAuth();
  const { empresaId } = useMultiempresa();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [acknowledgedMilestone, setAcknowledgedMilestone] = useState<number | null>(null);

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isBillingEnabled = import.meta.env.VITE_ENABLE_BILLING_SUBSCRIPTIONS === 'true';
  const isPreviewHost = ALLOWED_PREVIEW_HOSTNAMES.includes(hostname);
  const isProductionHost = BLOCKED_PRODUCTION_HOSTNAMES.includes(hostname);
  
  // Proteção em duas camadas
  const billingActive = isBillingEnabled && !isProductionHost && (isPreviewHost || !isProductionHost);

  const { data: sub, isLoading } = useSubscriptionContext(empresaId);

  // Simulação visual segura
  useEffect(() => {
    if (!billingActive || !isPreviewHost) return;
    
    const params = new URLSearchParams(window.location.search);
    const previewMilestone = params.get("previewTrialMilestone");
    if (previewMilestone && ["15", "7", "3", "1", "0"].includes(previewMilestone)) {
      setShowModal(true);
      // Aqui não salvamos no localStorage para permitir testes repetidos no preview
    }
  }, [billingActive, isPreviewHost]);

  useEffect(() => {
    if (!billingActive || !sub || sub.status !== "trialing" || !user?.id || !empresaId) return;

    const daysLeft = sub.days_remaining;
    const milestones = [15, 7, 3, 1, 0];
    
    if (milestones.includes(daysLeft)) {
      const storageKey = `vejamais:billing-trial:${user.id}:${empresaId}:${sub.trial_ends_at}:${daysLeft}`;
      const acknowledged = localStorage.getItem(storageKey);
      
      if (!acknowledged) {
        setShowModal(true);
        setAcknowledgedMilestone(daysLeft);
      }
    }
  }, [sub, user?.id, empresaId, billingActive]);

  if (!billingActive || isLoading || !sub || sub.status !== "trialing") {
    return null;
  }

  const handleAcknowledge = () => {
    if (user?.id && empresaId && sub.trial_ends_at && acknowledgedMilestone !== null) {
      const storageKey = `vejamais:billing-trial:${user.id}:${empresaId}:${sub.trial_ends_at}:${acknowledgedMilestone}`;
      localStorage.setItem(storageKey, "true");
    }
    setShowModal(false);
  };

  const daysLeft = sub.days_remaining;
  const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const formattedDate = trialEndsAt ? format(trialEndsAt, "dd/MM/yyyy", { locale: ptBR }) : "";

  return (
    <>
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-2 text-primary font-medium">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            Você está no período de avaliação do <strong>{sub.plan_name}</strong>. 
            Restam <strong>{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</strong>.
          </span>
        </div>
        <Button variant="link" size="sm" className="h-7 text-primary font-semibold hover:no-underline p-0 flex items-center gap-1.5" asChild>
          <Link to="/configuracoes/assinatura">
            <CreditCard className="size-3.5" />
            <span>Assinar Agora</span>
          </Link>
        </Button>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => !open && handleAcknowledge()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-primary" />
              {daysLeft === 0 ? "Período de avaliação encerrado" : "Sua avaliação está terminando"}
            </DialogTitle>
            <DialogDescription className="py-4">
              {daysLeft === 0 ? (
                <>
                  Seu período gratuito terminou em {formattedDate}.<br />
                  Seus dados continuam preservados.<br />
                  Conheça o Plano Empresarial para continuar utilizando todos os recursos.
                </>
              ) : (
                <>
                  Seu período gratuito termina em {formattedDate}.<br />
                  Restam {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} para aproveitar todos os recursos.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {daysLeft > 0 && (
              <Button variant="ghost" onClick={handleAcknowledge}>
                Agora não
              </Button>
            )}
            <Button asChild onClick={handleAcknowledge}>
              <Link to="/configuracoes/assinatura">
                Conhecer Plano Empresarial
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
