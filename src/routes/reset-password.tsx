import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VejamaisMark } from "@/components/vejamais-logo";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/auth-errors";
import { useServerFn } from "@tanstack/react-start";
import { checkResetPasswordContext } from "@/lib/reset-password.functions";

type ResetState = "checking" | "ready" | "invalid" | "saving" | "success" | "error";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<ResetState>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasPending, setHasPending] = useState(false);
  
  const validateContext = useServerFn(checkResetPasswordContext);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      // 1. Iniciar timeout de 10s para a saída finita
      checkTimeoutRef.current = setTimeout(() => {
        if (mounted && state === "checking") {
          setState("invalid");
          setErrorMessage("Tempo limite de validação excedido. Por favor, tente novamente através do link no e-mail.");
        }
      }, 10000);

      try {
        // 2. Aguardar sessão (o callback já deve ter processado, mas garantimos o getSession)
        const { data: { session } } = await supabase.auth.getSession();
        
        // 3. Listener de PASSWORD_RECOVERY (como fallback)
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
            if (mounted) {
              // Verificamos o contexto novamente para ter certeza que é um reset permitido
              validateContext().then(result => {
                if (mounted && result.allowed) {
                  setHasPending(result.hasPending || false);
                  setState("ready");
                  if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
                }
              });
            }
          }
        });

        if (session) {
          // 4. Validar server-side pela identidade da sessão
          const result = await validateContext();
          
          if (!mounted) return;

          if (result.allowed) {
            setHasPending(result.hasPending || false);
            setState("ready");
            if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
          } else {
            setState("invalid");
            setErrorMessage(result.reason || "Sessão inválida para redefinição.");
          }
        } else {
          // Se não há sessão após alguns segundos e nenhum evento, invalidar
          // (O timeout de 10s cuidará disso se nada acontecer)
        }

        return () => {
          sub.subscription.unsubscribe();
        };
      } catch (err) {
        if (mounted) {
          setState("error");
          setErrorMessage("Ocorreu um erro ao validar seu acesso.");
        }
      }
    }

    const cleanup = initialize();
    return () => {
      mounted = false;
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      cleanup.then(fn => fn?.());
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state !== "ready") return;
    
    // Política mínima de senha
    if (password.length < 8) return toast.error("A senha deve ter no mínimo 8 caracteres.");
    if (!/[A-Z]/.test(password)) return toast.error("A senha deve conter pelo menos uma letra maiúscula.");
    if (!/[0-9]/.test(password)) return toast.error("A senha deve conter pelo menos um número.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    
    setState("saving");
    
    try {
      // Execução puramente cliente -> Supabase Auth
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        setState("ready");
        toast.error(translateAuthError(error.message));
        return;
      }

      toast.success("Senha definida com sucesso!");
      setState("success");

      // Verificação final de destino (server-side via identide da sessão recém-atualizada)
      const result = await validateContext();
      
      setTimeout(() => {
        if (result.hasPending) {
          navigate({ to: "/ativar-conta", replace: true });
        } else {
          navigate({ to: "/dashboard", replace: true });
        }
      }, 1500);

    } catch (err) {
      setState("ready");
      toast.error("Erro ao atualizar a senha. Tente novamente.");
    }
  }

  const isButtonDisabled = state === "saving" || state !== "ready" || password.length < 8 || password !== confirm;

  return (
    <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <VejamaisMark size={64} className="rounded-2xl shadow-glow" />
          </div>
          <h1 className="font-display text-3xl text-foreground">
            {hasPending ? "Ative sua conta" : "Redefinir senha"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {state === "checking" && "Validando o link de redefinição..."}
            {state === "ready" && "Defina sua nova senha de acesso à VEJAMAIS."}
            {state === "invalid" && (errorMessage || "Este link é inválido ou já foi utilizado.")}
            {state === "saving" && "Salvando sua nova senha..."}
            {state === "success" && "Senha salva! Redirecionando..."}
            {state === "error" && (errorMessage || "Erro na validação.")}
          </p>
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-6">
          {state === "invalid" || state === "error" ? (
            <div className="space-y-4">
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 text-center">
                {errorMessage}
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Voltar para o Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="np">Nova senha</Label>
                <Input 
                  id="np" 
                  type="password" 
                  required 
                  autoComplete="new-password"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  disabled={state !== "ready"}
                />
                <ul className="text-[10px] text-muted-foreground space-y-1 ml-1 list-disc list-inside">
                  <li className={password.length >= 8 ? "text-primary" : ""}>Mínimo de 8 caracteres</li>
                  <li className={/[A-Z]/.test(password) ? "text-primary" : ""}>Pelo menos uma letra maiúscula</li>
                  <li className={/[0-9]/.test(password) ? "text-primary" : ""}>Pelo menos um número</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp">Confirmar nova senha</Label>
                <Input 
                  id="cp" 
                  type="password" 
                  required 
                  autoComplete="new-password"
                  value={confirm} 
                  onChange={(e) => setConfirm(e.target.value)} 
                  disabled={state !== "ready"}
                />
                {confirm && password !== confirm && (
                  <p className="text-[10px] text-destructive">As senhas não coincidem</p>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={isButtonDisabled} 
                className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95"
              >
                {state === "saving" ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
