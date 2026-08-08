import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";

export const Route = createFileRoute("/auth/callback/")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback/" }) as any;
  const [status, setStatus] = useState("Processando autenticação...");
  const processingRef = useRef(false);

  useEffect(() => {
    async function handleAuth() {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const code = search.code;
        if (code) {
          setStatus("Trocando código por sessão...");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        setStatus("Confirmando identidade...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (search.error) {
            throw new Error(search.error_description || search.error || "Falha na autenticação");
          }
          throw new Error("Sessão não encontrada");
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw userError || new Error("Usuário não validado");

        const isRecovery = window.location.hash.includes("type=recovery") || search.type === "recovery";
        const isSignup = window.location.hash.includes("type=signup") || search.type === "signup" || search.type === "invite";

        if (isRecovery) {
          setStatus("Redirecionando para redefinição de senha...");
          navigate({ to: "/reset-password", replace: true });
        } else if (isSignup) {
          setStatus("Redirecionando para ativação...");
          navigate({ to: "/ativar-conta", replace: true });
        } else {
          setStatus("Redirecionando...");
          navigate({ to: "/ativar-conta", replace: true });
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        toast.error(error.message || "Falha ao processar autenticação");
        navigate({ to: "/login", replace: true });
      }
    }

    handleAuth();
  }, [search, navigate]);

  return (
    <div className="min-h-screen bg-gradient-rose flex flex-col items-center justify-center px-4">
      <VejamaisMark size={64} className="mb-6 animate-pulse" />
      <div className="text-foreground font-medium">{status}</div>
      <p className="text-xs text-muted-foreground mt-4">Aguarde, estamos preparando seu acesso.</p>
    </div>
  );
}
