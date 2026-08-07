import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { useServerFn } from "@tanstack/react-start";
import { completeCompanyOnboarding } from "@/lib/onboarding.functions";
import { toast } from "sonner";

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

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("company_settings" as any).select("theme").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const theme = (data as any)?.theme ?? "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
    });
  }, [user?.id]);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  // Onboarding automático se o usuário não tem nenhuma empresa
  useEffect(() => {
    async function checkOnboarding() {
      if (!loading && session && !contextLoading && companies.length === 0) {
        try {
          const metadata = session.user.user_metadata || {};
          const nomeEmpresa = metadata.nome_empresa || "Minha Empresa";
          const documento = metadata.cnpj || "00.000.000/0000-00";
          
          await runOnboarding({
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
          toast.success("Empresa configurated com sucesso!");
        } catch (err) {
          console.error("Erro no onboarding automático:", err);
        }
      }
    }
    checkOnboarding();
  }, [loading, session, contextLoading, companies.length, runOnboarding, refetch]);

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
    </ConfirmProvider>
  );
}
