import React, { useState, useEffect, useMemo } from "react";
import { useBillingContext } from "@/hooks/use-subscription-context";
import { AlertCircle, CreditCard } from "lucide-react";
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
import { Link } from "@tanstack/react-router";
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
  const [showModal, setShowModal] = useState(false);
  const [acknowledgedMilestone, setAcknowledgedMilestone] = useState<number | null>(null);

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isBillingEnabled = import.meta.env.VITE_ENABLE_BILLING_SUBSCRIPTIONS === 'true';
  const isPreviewHost = ALLOWED_PREVIEW_HOSTNAMES.includes(hostname);
  const isProductionHost = BLOCKED_PRODUCTION_HOSTNAMES.includes(hostname);
  
  // Proteção segura: desativa se não houver variável ou se for produção
  const billingActive = isBillingEnabled && !isProductionHost && (isPreviewHost || hostname === "");

  const { data: context, isLoading } = useBillingContext(empresaId);
  const sub = context?.subscription;

  // Simulação visual canônica baseada em URL
  const displayRemainingDays = useMemo(() => {
    if (!billingActive || !isPreviewHost || typeof window === "undefined") {
      return sub?.days_remaining ?? null;
    }
    const params = new URLSearchParams(window.location.search);
    const previewMilestone = params.get("previewTrialMilestone");
    if (previewMilestone && ["15", "7", "3", "1", "0"].includes(previewMilestone)) {
      return parseInt(previewMilestone, 10);
    }
    return sub?.days_remaining ?? null;
  }, [billingActive, isPreviewHost, sub?.days_remaining]);


  // Controle de abertura do modal
  useEffect(() => {
    if (!billingActive || !sub || sub.status !== "trialing" || displayRemainingDays === null) return;

    const milestones = [15, 7, 3, 1, 0];
    
    // Se for simulação no preview, abre sempre
    if (isPreviewHost) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("previewTrialMilestone")) {
        setShowModal(true);
        return;
      }
    }

    // Se for comportamento real de milestone
    if (milestones.includes(displayRemainingDays) && user?.id && empresaId) {
      const storageKey = `vejamais:billing-trial:${user.id}:${empresaId}:${sub.trial_ends_at}:${displayRemainingDays}`;
      const acknowledged = localStorage.getItem(storageKey);
      
      if (!acknowledged) {
        setShowModal(true);
        setAcknowledgedMilestone(displayRemainingDays);
      }
    }
  }, [sub, user?.id, empresaId, billingActive, isPreviewHost, displayRemainingDays]);

  if (!billingActive || isLoading || !sub || sub.status !== "trialing" || displayRemainingDays === null) {
    return null;
  }

  const handleAcknowledge = () => {
    if (user?.id && empresaId && sub.trial_ends_at && acknowledgedMilestone !== null) {
      const storageKey = `vejamais:billing-trial:${user.id}:${empresaId}:${sub.trial_ends_at}:${acknowledgedMilestone}`;
      localStorage.setItem(storageKey, "true");
    }
    setShowModal(false);
  };

  const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const formattedDate = trialEndsAt ? format(trialEndsAt, "dd/MM/yyyy", { locale: ptBR }) : "";

  // Conteúdo textual dinâmico conforme protocolo
  const modalContent = {
    title: displayRemainingDays === 0 ? "Sua avaliação gratuita terminou" : "Sua avaliação está em andamento",
    message: displayRemainingDays === 0 
      ? "Conheça o Plano Empresarial para continuar utilizando todos os recursos da VEJAMAIS."
      : `Restam ${displayRemainingDays} ${displayRemainingDays === 1 ? 'dia' : 'dias'} para aproveitar todos os recursos da VEJAMAIS.`,
    showDate: displayRemainingDays > 0,
  };

  return (
    <>
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-2 text-primary font-medium" aria-live="polite">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            Você está no período de avaliação do <strong>Essencial</strong>. 
            {displayRemainingDays === 0 
              ? " Sua avaliação terminou." 
              : ` Restam ${displayRemainingDays} ${displayRemainingDays === 1 ? 'dia' : 'dias'}.`}
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
        <DialogContent className="sm:max-w-md" aria-label={modalContent.title}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-primary" />
              {modalContent.title}
            </DialogTitle>
            <DialogDescription className="py-4 text-foreground">
              <p className="mb-2 font-medium">{modalContent.message}</p>
              {modalContent.showDate && (
                <p className="text-xs text-muted-foreground">
                  Seu período gratuito termina em {formattedDate}.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {displayRemainingDays > 0 && (
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