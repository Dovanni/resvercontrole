import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";

export const Route = createFileRoute("/auth/callback/recovery")({
  component: RecoveryCallbackPage,
});

function RecoveryCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback/recovery" }) as any;
  const [status, setStatus] = useState("Validando acesso de recuperação...");
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    async function handleRecovery() {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        // 1. PKCE: exchangeCodeForSession
        // Na recuperação, o código vem no parâmetro 'code'
        const code = search.code;
        
        if (!code) {
          // Se não houver código, verificamos se já existe sessão (reload)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setStatus("Sessão confirmada. Redirecionando...");
            navigate({ to: "/reset-password", replace: true });
            return;
          }
          throw new Error("Código de recuperação ausente. Por favor, utilize o link do e-mail.");
        }

        setStatus("Estabelecendo conexão segura...");
        
        // Exchange code for session (PKCE)
        // Isso consome o code e estabelece a sessão no storage configurado
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error("Exchange error:", exchangeError);
          throw new Error("Este link expirou ou já foi utilizado.");
        }

        if (!data.session) {
          throw new Error("Não foi possível estabelecer uma sessão válida.");
        }

        // Confirmar persistência e usuário
        setStatus("Confirmando identidade...");
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw userError || new Error("Usuário não identificado após a troca.");
        }

        // Limpeza da URL e redirecionamento final
        setStatus("Acesso concedido.");
        
        // Redirecionar para reset-password
        // O navigate com replace remove o código da URL na barra do navegador
        navigate({ to: "/reset-password", replace: true });

      } catch (err: any) {
        console.error("Recovery callback fatal error:", err);
        setError(err.message || "Erro na validação do acesso.");
        setStatus("Falha na validação.");
        
        // Em caso de erro, não redirecionamos silenciosamente para o login
        // Mostramos o erro na tela para o usuário saber o que aconteceu
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
          <button 
            onClick={() => navigate({ to: "/login", replace: true })}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Voltar para o Login
          </button>
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
