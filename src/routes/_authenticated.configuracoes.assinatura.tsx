import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useBillingContext } from "@/hooks/use-subscription-context";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, CreditCard, Users, Clock, AlertCircle, Sparkles, ShieldCheck, HelpCircle } from "lucide-react";
import { format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppSupport } from "@/components/WhatsAppSupport";

export const Route = createFileRoute("/_authenticated/configuracoes/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura e Planos — VEJAMAIS ERP" }] }),
  component: SubscriptionSettingsPage,
});

export function SubscriptionSettingsPage() {
  const { empresaId } = useMultiempresa();
  const { data: context, isLoading, error, refetch } = useBillingContext(empresaId);
  const [showHelp, setShowHelp] = useState(false);
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const checkoutStatusParam = searchParams.get("checkout");

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando informações da assinatura...</div>;

  const billingError = error as Error | null;
  if (billingError || !context) {
    const isNotFoundError = billingError?.message === 'SUBSCRIPTION_NOT_FOUND';
    const isAuthError = billingError?.message === 'UNAUTHENTICATED';
    const isForbiddenError = billingError?.message === 'COMPANY_ACCESS_DENIED';
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <PageHeader title="Assinatura" subtitle="Gerencie seu plano e pagamentos" />
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">
              {isNotFoundError ? "Assinatura não encontrada" : isAuthError ? "Sessão expirada" : isForbiddenError ? "Acesso à empresa não autorizado" : "Erro ao carregar faturamento"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {isNotFoundError ? "Não foi possível carregar os dados da sua assinatura." : isAuthError ? "Por favor, realize o login novamente." : isForbiddenError ? "Você não tem permissão para acessar o faturamento desta empresa." : "Não foi possível estabelecer conexão com o serviço de faturamento."}
            </p>
            <div className="flex gap-4 justify-center">
              {billingError && !isNotFoundError && <Button onClick={() => refetch()}>Tentar novamente</Button>}
              <Button variant="outline" asChild><Link to="/configuracoes">Voltar para Configurações</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription: sub, checkout: status, billing_mode: billingMode } = context;
  const isInstitutional = billingMode === 'institutional';
  const isTrial = sub.status === "trialing";
  const isEnterpriseTrial = isTrial && sub.plan_code === 'enterprise_monthly';
  const isEssentialTrial = isTrial && sub.plan_code === 'essential_trial';
  const isExpiredTrial = sub.status === 'restricted' && sub.plan_code === 'essential_trial';
  const canStartCheckout = isEssentialTrial || sub.status === 'none' || isExpiredTrial;

  const statusColor = isInstitutional
    ? "bg-primary/10 text-primary border-primary/20"
    : ({
        active: "bg-green-500/10 text-green-600 border-green-200",
        trialing: "bg-primary/10 text-primary border-primary/20",
        past_due: "bg-amber-500/10 text-amber-600 border-amber-200",
        grace_read_only: "bg-orange-500/10 text-orange-600 border-orange-200",
        restricted: "bg-destructive/10 text-destructive border-destructive/20",
        canceled: "bg-muted text-muted-foreground border-muted-foreground/20",
        none: "bg-muted text-muted-foreground",
      }[sub.status as string] || "bg-muted text-muted-foreground");

  const statusLabel = isInstitutional
    ? "Ambiente administrativo"
    : ({
        active: "Ativa",
        trialing: "Período de avaliação",
        past_due: "Pagamento Pendente",
        grace_read_only: "Aguardando Pagamento",
        restricted: isExpiredTrial ? "Avaliação encerrada" : "Restrita",
        canceled: "Cancelada",
        none: "Sem Assinatura",
      }[sub.status as string] || sub.status);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Assinatura"
        subtitle={isInstitutional ? "Configurações institucionais da plataforma" : "Controle seu plano, limites e faturamento"}
        action={!isInstitutional ? (
          <Button variant="outline" size="sm" onClick={() => setShowHelp(true)}>
            <HelpCircle className="mr-2 size-4" />
            Como funciona esta etapa?
          </Button>
        ) : undefined}
      />

      {!isInstitutional && (
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <HelpCircle className="size-5 text-primary" />
                Como funciona esta etapa?
              </DialogTitle>
              <DialogDescription>
                Entenda o período gratuito, a contratação do Plano Empresarial, a cobrança mensal e como cancelar ou continuar sua assinatura com segurança.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 text-sm">
              <section className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  <h3 className="font-semibold">Plano gratuito — período de avaliação de 30 dias</h3>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <p>Ao iniciar sua empresa no VEJAMAIS ERP, você recebe um período gratuito de 30 dias para conhecer e utilizar os recursos disponíveis na avaliação.</p>
                  <ul className="ml-5 list-disc space-y-1">
                    <li>Você acompanha nesta página a data de término e quantos dias ainda restam.</li>
                    <li>Durante a avaliação, você pode contratar o Plano Empresarial a qualquer momento.</li>
                    <li>Contratar antes do fim da avaliação não elimina os dias gratuitos restantes.</li>
                    <li>A primeira cobrança somente ocorre após o término do período gratuito indicado na sua assinatura.</li>
                  </ul>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-foreground">
                    <strong>Exemplo:</strong> se ainda faltarem 20 dias e você contratar hoje, esses 20 dias continuam válidos. A cobrança ficará para depois do término da avaliação.
                  </div>
                </div>
              </section>

              <section className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  <h3 className="font-semibold">Plano Empresarial — R$ 35,90 por mês</h3>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <p>Para continuar utilizando os recursos comerciais após o período gratuito, você pode contratar o Plano Empresarial por R$ 35,90 ao mês.</p>
                  <ul className="ml-5 list-disc space-y-1">
                    <li>O pagamento é processado em ambiente seguro pela Stripe.</li>
                    <li>Após a contratação, esta página passa a informar que o Plano Empresarial está contratado.</li>
                    <li>Se a avaliação ainda estiver ativa, ela continua normalmente até a data exibida.</li>
                    <li>Depois do início das cobranças, a assinatura é renovada mensalmente enquanto permanecer ativa.</li>
                  </ul>
                  <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-900">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    <span>Os dados sensíveis do cartão são tratados no ambiente seguro de pagamento da Stripe, e não diretamente nesta tela do VEJAMAIS ERP.</span>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                  <h3 className="font-semibold">Gerenciar assinatura e forma de pagamento</h3>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <p>Quando o Plano Empresarial estiver contratado, utilize o botão <strong className="text-foreground">Gerenciar assinatura</strong> para acessar o portal seguro da Stripe.</p>
                  <p>Nesse portal você poderá consultar sua assinatura, atualizar a forma de pagamento, acompanhar informações de faturamento e acessar as opções de cancelamento disponíveis.</p>
                  <div className="rounded-lg border bg-background p-3 font-medium text-foreground">
                    VEJAMAIS ERP → Gerenciar assinatura → Portal seguro da Stripe
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">4</span>
                  <h3 className="font-semibold text-amber-950">Como cancelar a assinatura</h3>
                </div>
                <div className="space-y-2 text-amber-900/80">
                  <p>Se você decidir não continuar com o Plano Empresarial, abra <strong className="text-amber-950">Gerenciar assinatura</strong> e selecione a opção de cancelamento no portal da Stripe.</p>
                  <ul className="ml-5 list-disc space-y-1">
                    <li>O cancelamento pode ser solicitado antes da próxima renovação.</li>
                    <li>Quando o encerramento estiver programado para uma data futura, o acesso permanece disponível até a data indicada.</li>
                    <li>Após o encerramento efetivo, não haverá nova renovação recorrente daquela assinatura.</li>
                    <li>O VEJAMAIS ERP mostrará o estado do cancelamento assim que a confirmação da Stripe for refletida na assinatura.</li>
                  </ul>
                  <div className="rounded-lg border border-amber-200 bg-white/70 p-3 font-medium text-amber-950">
                    Exemplo: “Cancelamento agendado — acesso disponível até 29/09/2026”.
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">5</span>
                  <h3 className="font-semibold text-blue-950">Mudei de ideia — como continuar com a assinatura?</h3>
                </div>
                <div className="space-y-2 text-blue-900/80">
                  <p>Enquanto o cancelamento ainda estiver apenas agendado e a assinatura não tiver terminado, entre novamente em <strong className="text-blue-950">Gerenciar assinatura</strong>.</p>
                  <p>No portal da Stripe, utilize a opção apresentada para <strong className="text-blue-950">não cancelar/continuar a assinatura</strong>. Depois da confirmação, o cancelamento agendado será removido e o plano continuará normalmente.</p>
                </div>
              </section>

              <section className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">6</span>
                  <h3 className="font-semibold">O que acontece quando o cancelamento se torna definitivo?</h3>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <p>Quando chegar a data efetiva de encerramento, a assinatura passa para a situação de cancelada e as regras de acesso previstas para uma assinatura encerrada passam a valer.</p>
                  <p>Para voltar a utilizar os recursos comerciais que dependem de uma assinatura ativa, siga as opções de reativação ou nova contratação que estiverem disponíveis no VEJAMAIS ERP.</p>
                </div>
              </section>

              <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <h3 className="mb-2 font-semibold text-primary">Resumo importante</h3>
                <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
                  <li>Você não perde os dias restantes da avaliação ao contratar antecipadamente.</li>
                  <li>A cobrança mensal do Plano Empresarial é de R$ 35,90.</li>
                  <li>O gerenciamento da assinatura e do cartão ocorre no portal seguro da Stripe.</li>
                  <li>Se cancelar, você verá até quando o acesso continuará disponível quando houver encerramento agendado.</li>
                  <li>Antes do encerramento efetivo, você poderá voltar ao portal e optar por continuar com a assinatura.</li>
                </ul>
              </section>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:items-center sm:justify-between">
              <WhatsAppSupport variant="link" message="Olá! Preciso de ajuda para entender minha assinatura do VEJAMAIS." />
              <Button onClick={() => setShowHelp(false)}>Entendi, fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {checkoutStatusParam === 'cancel' && !isInstitutional && canStartCheckout && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">Checkout interrompido</p>
            <p className="text-sm text-amber-700">Você saiu do checkout antes de concluir. Nenhum pagamento foi realizado. Se desejar, você pode retomar o mesmo checkout com segurança.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="md:col-span-2 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="font-display text-2xl">
                  {isInstitutional ? "Plano atual: Acesso Institucional" : `Plano Atual: ${sub.plan_code === 'essential_trial' ? 'Essencial — Avaliação gratuita' : sub.plan_name}`}
                </CardTitle>
              </div>
              <Badge className={`${statusColor} capitalize px-3 py-1 font-semibold`}>{statusLabel}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Users className="size-5 text-primary" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{isInstitutional ? "Usuários ativos" : "Usuários"}</div>
                  <div className="text-sm font-medium">{isInstitutional ? `${sub.current_user_count} membros` : `${sub.current_user_count} de 5 utilizados`}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Clock className="size-5 text-primary" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{isInstitutional ? "Faturamento" : (isTrial ? "Expira em" : "Valor Mensal")}</div>
                  <div className="text-sm font-medium">
                    {isInstitutional ? "Não aplicável" : isTrial ? (
                      <>
                        {sub.current_period_ends_at ? format(new Date(sub.current_period_ends_at), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
                        <span className="ml-2 text-xs text-muted-foreground">({sub.days_remaining} {sub.days_remaining === 1 ? 'dia' : 'dias'} restantes)</span>
                      </>
                    ) : "R$ 35,90 / mês"}
                  </div>
                </div>
              </div>
            </div>

            {isInstitutional && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <h4 className="font-semibold text-primary flex items-center gap-2 mb-2"><ShieldCheck className="size-4" />Acesso administrativo da plataforma</h4>
                <p className="text-sm text-muted-foreground">Este ambiente é destinado à administração institucional da VEJAMAIS ERP. Não há contratação comercial ou cobrança vinculada a esta empresa.</p>
                <div className="mt-4 pt-4 border-t border-primary/10 flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Empresa Matriz da VEJAMAIS ERP</span>
                  <span className="text-xs text-muted-foreground">Acesso institucional à plataforma</span>
                </div>
              </div>
            )}

            {!isInstitutional && isEnterpriseTrial && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <h4 className="font-semibold text-primary flex items-center gap-2 mb-2"><ShieldCheck className="size-4" />Plano Empresarial contratado</h4>
                <p className="text-sm text-muted-foreground">
                  Seu Plano Empresarial já está contratado e o período de avaliação permanece ativo. A primeira cobrança de R$ 35,90 ocorrerá somente após o término da avaliação.
                </p>
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground italic font-medium leading-relaxed flex items-center gap-1"><ShieldCheck className="size-3 text-green-500" />Assinatura protegida e processada pela Stripe</p>
                  <Button
                    variant="outline"
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      if (btn.disabled) return;
                      btn.disabled = true;
                      const originalText = btn.innerText;
                      btn.innerText = "Carregando portal seguro...";
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const response = await fetch('/api/public/billing/create-portal-session', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
                          body: JSON.stringify({ empresaId })
                        });
                        if (!response.ok) {
                          console.error("Portal session failed:", await response.json());
                          btn.disabled = false;
                          btn.innerText = originalText;
                          return;
                        }
                        const result = await response.json();
                        if (result && typeof result.url === 'string') {
                          const url = new URL(result.url);
                          if (url.protocol === "https:" && url.hostname === "billing.stripe.com") window.location.assign(result.url);
                          else {
                            btn.disabled = false;
                            btn.innerText = originalText;
                          }
                        }
                      } catch (err) {
                        console.error("Portal session error:", err);
                        btn.disabled = false;
                        btn.innerText = originalText;
                      }
                    }}
                    className="w-full sm:w-auto"
                  >Gerenciar assinatura</Button>
                  {status?.environment !== 'live' && <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-1 px-2 rounded border border-amber-200 w-fit">AMBIENTE DE TESTE (SANDBOX) — NENHUMA COBRANÇA REAL</p>}
                </div>
              </div>
            )}

            {!isInstitutional && canStartCheckout && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                <h4 className="font-semibold text-primary flex items-center gap-2 mb-2"><Sparkles className="size-4" />Aproveite o VEJAMAIS ERP ao máximo</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {isExpiredTrial
                    ? "Seu período gratuito de 30 dias terminou. Assine o Plano Empresarial para continuar utilizando todos os recursos do VEJAMAIS ERP."
                    : "Seu período gratuito oferece acesso a todos os recursos durante 30 dias. Assine o Plano Empresarial agora e a primeira cobrança ocorrerá somente após o término da avaliação."}
                </p>
                <div className="space-y-2">
                  {(() => {
                    const isCtaEnabled = !!status?.enabled && canStartCheckout;
                    const isLive = status?.environment === 'live';
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
                              const { data: { session } } = await supabase.auth.getSession();
                              const response = await fetch('/api/public/billing/create-checkout-v2', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
                                },
                                body: JSON.stringify({ empresaId })
                              });
                              if (!response.ok) {
                                console.error("Checkout session failed:", await response.json());
                                btn.disabled = false;
                                btn.innerText = originalText;
                                return;
                              }

                              const data = await response.json();
                              const isValidUrl = typeof data.url === "string";
                              const checkoutUrl = isValidUrl ? new URL(data.url) : null;
                              const isHttps = checkoutUrl?.protocol === "https:";
                              const isStripeHost = checkoutUrl?.hostname === "checkout.stripe.com";
                              const expectedPrefix = isLive ? "cs_live_" : "cs_test_";
                              const isExpectedSession = typeof data.sessionId === "string" && data.sessionId.startsWith(expectedPrefix);
                              const environmentMatches = data.environment ? data.environment === status?.environment : true;

                              if (isValidUrl && isHttps && isStripeHost && isExpectedSession && environmentMatches) {
                                window.location.assign(data.url);
                              } else {
                                console.error("Security validation failed for checkout redirect", { sessionId: data.sessionId, environment: data.environment });
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
                          {checkoutStatusParam === 'cancel' ? "Retomar checkout seguro — R$ 35,90/mês" : "Assinar Plano Empresarial — R$ 35,90/mês"}
                        </Button>

                        {!isCtaEnabled && (
                          <p className="text-[10px] text-amber-600 font-medium leading-relaxed bg-amber-50 p-2 rounded border border-amber-100 flex items-center gap-1.5">
                            <AlertCircle className="size-3" />Checkout indisponível neste ambiente.
                          </p>
                        )}

                        {isCtaEnabled && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-muted-foreground italic font-medium leading-relaxed flex items-center gap-1"><ShieldCheck className="size-3 text-green-500" />Pagamento seguro processado pela Stripe</p>
                            {!isLive && <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-1 px-2 rounded border border-amber-200 w-fit">AMBIENTE DE TESTE (SANDBOX) — NENHUMA COBRANÇA REAL</p>}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {!isTrial && !isExpiredTrial && (sub.status === 'active' || sub.status === 'past_due' || sub.status === 'canceled') && (
              <div className="p-4 rounded-xl bg-muted/30 border space-y-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Gestão de Assinatura</h4>
                    <p className="text-sm text-muted-foreground">Acesse o portal de autoatendimento para atualizar seu cartão, consultar faturas ou gerenciar seu plano.</p>
                  </div>
                </div>

                {sub.status === 'canceled' && sub.current_period_ends_at && isAfter(new Date(sub.current_period_ends_at), new Date()) && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-600" />
                    <p className="text-xs font-medium text-amber-900">Cancelamento agendado — acesso disponível até {format(new Date(sub.current_period_ends_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    if (btn.disabled) return;
                    btn.disabled = true;
                    const originalText = btn.innerText;
                    btn.innerText = "Carregando portal seguro...";
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const response = await fetch('/api/public/billing/create-portal-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
                        body: JSON.stringify({ empresaId })
                      });
                      if (!response.ok) {
                        console.error("Portal session failed:", await response.json());
                        btn.disabled = false;
                        btn.innerText = originalText;
                        return;
                      }
                      const result = await response.json();
                      if (result && typeof result.url === 'string') {
                        const url = new URL(result.url);
                        if (url.protocol === "https:" && url.hostname === "billing.stripe.com") window.location.assign(result.url);
                        else {
                          btn.disabled = false;
                          btn.innerText = originalText;
                        }
                      }
                    } catch (err) {
                      console.error("Portal session error:", err);
                      btn.disabled = false;
                      btn.innerText = originalText;
                    }
                  }}
                  className="w-full sm:w-auto"
                >Gerenciar assinatura e pagamentos</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="text-lg">{isInstitutional ? "Recursos do Ambiente" : "Recursos do Plano"}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(isInstitutional ? [
                "Administração institucional", "Gestão multiempresa", "Acompanhamento operacional",
                "Controle de acessos e permissões", "Proteção e isolamento dos dados", "Suporte e auditoria administrativa"
              ] : [
                "Multiempresa Ativo", "Gestão Comercial Completa", "Controle Financeiro & DRE",
                "Até 5 Usuários inclusos", "Suporte Prioritário", "Importação via Excel", "Proteção e isolamento dos dados"
              ]).map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="size-4 text-green-500 mt-0.5 shrink-0" />{feature}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-6 border-t gap-4">
        <Button variant="ghost" asChild><Link to="/configuracoes">← Voltar para Configurações</Link></Button>
        <WhatsAppSupport variant="link" message="Olá! Preciso de ajuda com a assinatura do VEJAMAIS." />
      </div>
    </div>
  );
}