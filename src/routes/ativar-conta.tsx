import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { useServerFn } from "@tanstack/react-start";
import { reconcileAndFinalizeOnboarding } from "@/lib/auth-security.functions";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/ativar-conta")({
  head: () => ({ meta: [{ title: "Ativando sua conta — VEJAMAIS ERP" }] }),
  component: ActivationPage,
});

type ActivationState = "checking" | "reconciling" | "success" | "error";

function ActivationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ActivationState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  
  const reconcileFn = useServerFn(reconcileAndFinalizeOnboarding);

  const performActivation = async () => {
    setState("reconciling");
    setError(null);
    try {
      const result = await reconcileFn();
      
      if (result.success) {
        // Limpar caches multiempresa para forçar recarregamento do contexto
        await queryClient.cancelQueries();
        queryClient.clear();
        if (typeof window !== "undefined") {
          localStorage.removeItem("vejamais:active_empresa_id");
        }
        
        setState("success");
        toast.success("Empresa configurada com sucesso na VEJAMAIS ERP!");
        
        setTimeout(() => {
          navigate({ to: "/minha-empresa", replace: true });
        }, 2000);
      } else {
        throw new Error("Falha na reconciliação dos dados.");
      }
    } catch (err: any) {
      console.error("Erro na ativação:", err);
      setState("error");
      setError(err.message || "Ocorreu um erro ao ativar sua empresa. Tente novamente.");
    }
  };

  useEffect(() => {
    let mounted = true;
    async function checkAndActivate() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) setState("error");
        return;
      }
      if (mounted) {
        setUserEmail(session.user.email || "");
        performActivation();
      }
    }
    checkAndActivate();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <VejamaisMark size={64} className="mx-auto mb-4 rounded-2xl shadow-glow" />
          <h1 className="font-display text-4xl text-foreground">VEJAMAIS ERP</h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gestão Comercial e Financeira — VEJAMAIS ERP</p>
          {userEmail && (
            <p className="mt-2 text-sm text-muted-foreground italic">
              {userEmail}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-8 flex flex-col items-center space-y-6">
          {state === "checking" && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-center text-muted-foreground">Verificando convite na VEJAMAIS ERP...</p>
            </>
          )}

          {state === "reconciling" && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <p className="font-medium">Finalizando provisionamento...</p>
                <p className="text-xs text-muted-foreground italic">Isso pode levar alguns segundos.</p>
              </div>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <div className="text-center space-y-2">
                <p className="font-medium text-lg">Tudo pronto!</p>
                <p className="text-sm text-muted-foreground">Sua empresa foi ativada. Redirecionando para o painel...</p>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="text-center space-y-4">
                <p className="font-medium text-destructive">Não foi possível ativar sua conta</p>
                <p className="text-sm text-muted-foreground bg-destructive/5 p-3 rounded-lg border border-destructive/10">
                  {error || "Sessão não identificada ou convite expirado."}
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={performActivation} className="w-full">
                    <RefreshCcw className="mr-2 h-4 w-4" /> Tentar novamente
                  </Button>
                  <Button variant="outline" onClick={() => navigate({ to: "/login" })} className="w-full">
                    Ir para Login
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="w-full bg-muted/30 p-4 rounded-xl text-[10px] text-muted-foreground flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <p>Sua segurança é nossa prioridade. Este processo garante que sua empresa seja provisionada exclusivamente para seu acesso na VEJAMAIS ERP.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
