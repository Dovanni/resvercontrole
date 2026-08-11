import { createFileRoute, Link } from "@tanstack/react-router";
import { useSubscriptionContext } from "@/hooks/use-subscription-context";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Users, Clock, AlertCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createStripeCheckoutSession } from "@/lib/billing.functions";
import { useCheckoutStatus } from "@/hooks/use-checkout-status";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura e Planos — Vejamais" }] }),
  component: SubscriptionSettingsPage,
});

export function SubscriptionSettingsPage() {
  const { empresaId } = useMultiempresa();
  const { data: sub, isLoading } = useSubscriptionContext(empresaId);
  const { data: status } = useCheckoutStatus(empresaId);
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const checkoutStatus = searchParams.get("checkout");

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando informações da assinatura...</div>;

  if (!sub) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <PageHeader title="Assinatura" subtitle="Gerencie seu plano e pagamentos" />
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Assinatura não encontrada</h3>
            <p className="text-muted-foreground mb-6">Não foi possível carregar os dados da sua assinatura.</p>
            <Button asChild>
              <Link to="/configuracoes">Voltar para Configurações</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isTrial = sub.status === "trialing";
  const statusColor = {
    active: "bg-green-500/10 text-green-600 border-green-200",
    trialing: "bg-primary/10 text-primary border-primary/20",
    past_due: "bg-amber-500/10 text-amber-600 border-amber-200",
    grace_read_only: "bg-orange-500/10 text-orange-600 border-orange-200",
    restricted: "bg-destructive/10 text-destructive border-destructive/20",
    none: "bg-muted text-muted-foreground",
  }[sub.status] || "bg-muted text-muted-foreground";

  const statusLabel = {
    active: "Ativa",
    trialing: "Período de avaliação",
    past_due: "Pagamento Pendente",
    grace_read_only: "Aguardando Pagamento",
    restricted: "Restrita",
    none: "Sem Assinatura",
  }[sub.status] || sub.status;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader 
        title="Assinatura" 
        subtitle="Controle seu plano, limites e faturamento" 
      />

      {checkoutStatus === 'cancel' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">Checkout interrompido</p>
            <p className="text-sm text-amber-700">
              Você saiu do checkout antes de concluir. Nenhum pagamento foi realizado e sua avaliação gratuita continua normalmente. Se desejar, você pode retomar o mesmo checkout com segurança.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="md:col-span-2 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="font-display text-2xl">
                  Plano Atual: {sub.plan_code === 'essencial' ? 'Essencial — Avaliação gratuita' : sub.plan_name}
                </CardTitle>
              </div>
              <Badge className={`${statusColor} capitalize px-3 py-1 font-semibold`}>
                {sub.plan_code === 'essencial' ? 'Período de avaliação' : statusLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Users className="size-5 text-primary" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Usuários</div>
                  <div className="text-sm font-medium">
                    {sub.current_user_count} de 5 utilizados
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Clock className="size-5 text-primary" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    {isTrial ? "Expira em" : "Valor Mensal"}
                  </div>
                  <div className="text-sm font-medium">
                    {isTrial ? (
                      <>
                        {sub.current_period_ends_at ? format(new Date(sub.current_period_ends_at), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({sub.days_remaining} {sub.days_remaining === 1 ? 'dia' : 'dias'} restantes)
                        </span>
                      </>
                    ) : (
                      "R$ 35,90 / mês"
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isTrial && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                <h4 className="font-semibold text-primary flex items-center gap-2 mb-2">
                  <Sparkles className="size-4" />
                  Aproveite o VEJAMAIS ao máximo
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Seu período gratuito oferece acesso a todos os recursos durante 30 dias. Assine o Plano Empresarial para continuar utilizando o VEJAMAIS após o término da avaliação.
                </p>
                <div className="space-y-2">
                  {(() => {
                    const isTrialing = sub.status === 'trialing';
                    
                    // Condição estrita vinda do servidor + trialing
                    const isCtaEnabled = !!status?.checkout_enabled && isTrialing;
                    const isLive = status?.billing_environment === 'live';

                    return (
                      <>
                        <Button 
                          disabled={!isCtaEnabled}
                          onClick={async (e) => {
                            const btn = e.currentTarget;
                            if (btn.disabled) return;
                            btn.disabled = true;
                            const originalText = btn.innerText;
                            btn.innerText = "Redirecionando para pagamento seguro...";
                            
                            try {
                              const result = await createStripeCheckoutSession(empresaId);
                              
                              if (result.status === 'session_created' && result.checkoutUrl) {
                                window.location.href = result.checkoutUrl;
                              } else {
                                console.error("Checkout session failed:", result);
                                btn.disabled = false;
                                btn.innerText = originalText;
                              }
                            } catch (err) {
                              console.error("Checkout error:", err);
                              btn.disabled = false;
                              btn.innerText = originalText;
                            }
                          }}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 border shadow-sm transition-all active:scale-[0.98]"
                        >
                          {checkoutStatus === 'cancel' ? "Retomar checkout seguro — R$ 35,90/mês" : "Assinar Plano Empresarial — R$ 35,90/mês"}
                        </Button>
                        
                        {!isCtaEnabled && (
                          <p className="text-[10px] text-amber-600 font-medium leading-relaxed bg-amber-50 p-2 rounded border border-amber-100 flex items-center gap-1.5">
                            <AlertCircle className="size-3" />
                            Checkout temporariamente indisponível. Por favor, tente novamente em alguns instantes.
                          </p>
                        )}
                        
                        {isCtaEnabled && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-muted-foreground italic font-medium leading-relaxed flex items-center gap-1">
                              <ShieldCheck className="size-3 text-green-500" />
                              Pagamento seguro processado pela Stripe
                            </p>
                            {!isLive && (
                              <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-1 px-2 rounded border border-amber-200 w-fit">
                                MODO SANDBOX / TESTE
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg">Recursos do Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                "Multiempresa Ativo",
                "Gestão Comercial Completa",
                "Controle Financeiro & DRE",
                "Até 5 Usuários inclusos",
                "Suporte Prioritário",
                "Importação via Excel",
                "Proteção e isolamento dos dados"
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-between items-center mt-4">
        <Button variant="ghost" asChild>
          <Link to="/configuracoes">← Voltar para Configurações</Link>
        </Button>
      </div>
    </div>
  );
}