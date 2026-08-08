import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VejamaisMark } from "@/components/vejamais-logo";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const recoverySearchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

type RecoveryStatus = "checking" | "verifying" | "success" | "invalid" | "error";

export const Route = createFileRoute("/auth/callback/recovery")({
  validateSearch: (search) => recoverySearchSchema.parse(search),
  component: RecoveryCallbackPage,
});

function RecoveryCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback/recovery" });
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [statusText, setStatusText] = useState("Validando link de recuperação...");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const processingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Proteção contra timeout (ex: rede lenta ou erro silencioso)
    timeoutRef.current = setTimeout(() => {
      if (status === "checking" || status === "verifying") {
        setStatus("error");
        setErrorMsg("A validação demorou mais do que o esperado. Por favor, tente novamente.");
      }
    }, 15000);

    async function handleRecovery() {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const { token_hash, code, type = "recovery", error: urlError, error_description } = search;

        if (urlError) {
          setStatus("invalid");
          throw new Error(error_description || urlError);
        }

        setStatus("verifying");
        setStatusText("Verificando sessão ativa...");

        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          setStatus("success");
          setStatusText("Sessão confirmada. Redirecionando...");
          clearTimeout(timeoutRef.current!);
          
          setTimeout(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
            navigate({ to: "/reset-password", replace: true });
          }, 1500);
          return;
        }

        if (!token_hash && !code) {
          setStatus("invalid");
          throw new Error("Link de segurança ausente ou incompleto.");
        }

        setStatusText("Autenticando acesso seguro...");
        
        let result;
        if (token_hash) {
          result = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any
          });
        } else if (code) {
          result = await supabase.auth.exchangeCodeForSession(code);
        }
        
        const { data, error: authError } = result!;
        
        if (authError) {
          setStatus("invalid");
          console.error("Auth verification error:", authError);
          throw new Error("Este link expirou ou já foi utilizado.");
        }

        if (!data.session) {
          setStatus("error");
          throw new Error("Não foi possível estabelecer uma sessão válida.");
        }

        setStatusText("Confirmando identidade...");
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          setStatus("error");
          throw userError || new Error("Usuário não identificado.");
        }

        setStatus("success");
        setStatusText("Acesso concedido com sucesso.");
        clearTimeout(timeoutRef.current!);
        
        setTimeout(() => {
          // Só limpamos a URL no sucesso final para não perder o token em caso de retry
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate({ to: "/reset-password", replace: true });
        }, 1500);

      } catch (err: any) {
        console.error("Recovery callback error:", err);
        setErrorMsg(err.message || "Erro na validação do acesso.");
        if (status !== "invalid") setStatus("error");
        processingRef.current = false;
        clearTimeout(timeoutRef.current!);
      }
    }

    handleRecovery();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [search, navigate]);

  return (
    <div className="min-h-screen bg-gradient-rose flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-soft border p-8 text-center transition-all duration-300">
        <VejamaisMark size={48} className="mx-auto mb-6" />
        
        {status === "checking" || status === "verifying" ? (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <h1 className="text-xl font-display text-foreground">{statusText}</h1>
            <p className="text-sm text-muted-foreground">
              Processando seu link de segurança. Por favor, aguarde e não feche esta página.
            </p>
          </div>
        ) : status === "success" ? (
          <div className="space-y-4 animate-in fade-in zoom-in duration-500">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-display text-foreground">{statusText}</h1>
            <p className="text-sm text-muted-foreground">
              Você será redirecionado para definir sua nova senha.
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-display text-foreground">
              {status === "invalid" ? "Link Inválido" : "Falha na Validação"}
            </h1>
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
              {errorMsg}
            </div>
            <div className="pt-4 space-y-3">
              <button 
                onClick={() => navigate({ to: "/recuperar-senha", replace: true })}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Solicitar novo link
              </button>
              <button 
                onClick={() => navigate({ to: "/login", replace: true })}
                className="w-full py-2.5 px-4 bg-secondary text-secondary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Voltar para o Login
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Fallback Error Boundary Visual */}
      <div className="mt-8 text-[10px] text-muted-foreground/30 font-mono">
        RCR-CB: {status.toUpperCase()}
      </div>
    </div>
  );
}
