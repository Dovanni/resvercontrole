import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { useServerFn } from "@tanstack/react-start";
import { completeCompanyOnboarding } from "@/lib/onboarding.functions";
import { toast } from "sonner";
import { WhatsAppSupport } from "@/components/WhatsAppSupport";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, user } = useAuth();
  const { companies, isLoading: contextLoading, refetch } = useMultiempresa();
  const runOnboarding = useServerFn(completeCompanyOnboarding);
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const intent = searchParams.get("intent");
  const [registrationState, setRegistrationState] = useState<'idle' | 'registering' | 'completed' | 'failed'>('idle');

  // Onboarding automático se o usuário não tem nenhuma empresa
  useEffect(() => {
    async function checkOnboarding() {
      // Bloqueio se já está registrando, se já completou nesta sessão, ou se o contexto ainda está carregando
      if (registrationState !== 'idle' || loading || contextLoading || !session) return;
      
      // Só dispara se realmente não houver empresas
      if (companies.length === 0) {
        setRegistrationState('registering');
        try {
          const metadata = session.user.user_metadata || {};
          const nomeEmpresa = metadata.nome_empresa || "Minha Empresa";
          const documento = metadata.cnpj || "00.000.000/0000-00";
          
          const result = await runOnboarding({
            data: {
              empresa: {
                nome: nomeEmpresa,
                documento: documento,
              },
              consentimentos: {
                termos_uso: true,
                politica_privacidade: true,
                versao: "1.0",
              }
            }
          });
          
          await refetch();
          setRegistrationState('completed');
          
          if (!(result as any)?.already_onboarded) {
            toast.success("Empresa configurada com sucesso!");
          }

          // Redirecionamento baseado na intenção após onboarding
          if (intent === 'empresarial') {
            navigate({ to: '/configuracoes/assinatura', replace: true });
          }
        } catch (err) {
          console.error("Erro no onboarding automático:", err);
          setRegistrationState('failed');
          // Permite retry manual via UI se implementado, ou via reload
        }
      }
    }
    checkOnboarding();
  }, [loading, session, contextLoading, companies.length, runOnboarding, refetch, registrationState]);

  if (loading || (session && contextLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <ConfirmProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <WhatsAppSupport />
    </ConfirmProvider>
  );
}
