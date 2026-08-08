import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VejamaisMark } from "@/components/vejamais-logo";
import { z } from "zod";

const recoverySearchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback/recovery")({
  validateSearch: (search) => recoverySearchSchema.parse(search),
  component: RecoveryCallbackPage,
});

function RecoveryCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback/recovery" });
  const [status, setStatus] = useState("Validando acesso de recuperação...");
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    async function handleRecovery() {
      // Proteção contra dupla execução (StrictMode) e loop
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const { token_hash, code, type = "recovery", error: urlError, error_description } = search;

        // 0. Verificar erros do Supabase na URL
        if (urlError) {
          throw new Error(error_description || urlError);
        }

        // 1. Verificar se já existe sessão (evita re-processar se o usuário der refresh ou houver loop)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        // Se já temos sessão, verificamos se ela é válida para o que queremos
        if (existingSession) {
          setStatus("Sessão confirmada. Redirecionando...");
          // Limpeza da URL antes de navegar
          if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          navigate({ to: "/reset-password", replace: true });
          return;
        }

        // 2. Validar presença de tokens
        if (!token_hash && !code) {
          throw new Error("Link de segurança inválido ou incompleto.");
        }

        setStatus("Estabelecendo conexão segura...");
        
        let result;
        if (token_hash) {
          // Fluxo OTP/Application-Owned
          result = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any
          });
        } else if (code) {
          // Fluxo PKCE fallback
          result = await supabase.auth.exchangeCodeForSession(code);
        }
        
        const { data, error: authError } = result!;
        
        if (authError) {
          console.error("Auth verification error:", authError);
          throw new Error("Este link expirou ou já foi utilizado.");
        }

        if (!data.session) {
          throw new Error("Não foi possível estabelecer uma sessão válida.");
        }

        // 3. Confirmar usuário
        setStatus("Confirmando identidade...");
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw userError || new Error("Usuário não identificado.");
        }

        setStatus("Acesso concedido.");
        
        // 4. Limpeza da URL e Redirecionamento
        // Removemos token_hash/code antes da navegação para evitar loops se o router re-avaliar
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Navegação final para redefinição
        navigate({ to: "/reset-password", replace: true });

      } catch (err: any) {
        console.error("Recovery callback fatal error:", err);
        setError(err.message || "Erro na validação do acesso.");
        setStatus("Falha na validação.");
        processingRef.current = false; // Permite tentar novamente se for erro temporário
      }
    }

    handleRecovery();
  }, [search, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-rose flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-card shadow-soft border p-8 text-center">
          <VejamaisMark size={48} className="mx-auto mb-6 text-destructive" />
          <h1 className="text-xl font-display text-foreground mb-4">Falha na Recuperação</h1>
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 mb-6">
            {error}
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => navigate({ to: "/recuperar-senha", replace: true })}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Solicitar novo link
            </button>
            <button 
              onClick={() => navigate({ to: "/login", replace: true })}
              className="w-full py-2 px-4 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Voltar para o Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-rose flex flex-col items-center justify-center px-4">
      <VejamaisMark size={64} className="mb-6 animate-pulse" />
      <div className="text-foreground font-medium">{status}</div>
      <p className="text-xs text-muted-foreground mt-4 text-center max-w-xs">
        Processando seu link de segurança. Por favor, aguarde e não feche esta página.
      </p>
    </div>
  );
}
