import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { useServerFn } from "@tanstack/react-start";
import { finalizeOnboarding } from "@/lib/auth-security.functions";
import { Lock, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/ativar-conta")({
  head: () => ({ meta: [{ title: "Ativar minha conta — Vejamais" }] }),
  component: ActivationPage,
});

function ActivationPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  
  const finalizeFn = useServerFn(finalizeOnboarding);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsSessionValid(false);
        // Não redirecionar imediatamente para dar chance ao usuário ver que precisa do link do convite
        return;
      }
      setIsSessionValid(true);
      setUserEmail(session.user.email || "");
    }
    checkSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setBusy(true);

    try {
      // 1. Atualizar a senha no Auth do Supabase (A sessão já existe pelo convite)
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      // 2. Finalizar onboarding no servidor (Criar empresa, perfis, etc)
      await finalizeFn();

      toast.success("Conta ativada com sucesso! Bem-vindo ao Vejamais.");
      navigate({ to: "/dashboard" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao ativar conta.");
    } finally {
      setBusy(false);
    }
  }

  if (isSessionValid === false) {
    return (
      <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <VejamaisMark size={64} className="mx-auto mb-6 opacity-50 grayscale" />
          <h1 className="text-2xl font-display mb-4">Link de ativação necessário</h1>
          <p className="text-muted-foreground mb-8">
            Para ativar sua conta, utilize o link enviado para o seu e-mail de administrador.
          </p>
          <Button variant="outline" onClick={() => navigate({ to: "/login" })}>
            Ir para Login
          </Button>
        </div>
      </div>
    );
  }

  if (isSessionValid === null) {
    return (
      <div className="min-h-screen bg-gradient-rose flex items-center justify-center">
        <div className="animate-pulse text-primary font-medium">Verificando convite...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <VejamaisMark size={64} className="mx-auto mb-4 rounded-2xl shadow-glow" />
          <h1 className="font-display text-3xl text-foreground">Defina sua senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você está ativando o acesso para <strong>{userEmail}</strong>
          </p>
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  autoFocus
                  placeholder="Mínimo 8 caracteres"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="pl-10"
                />
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input 
                  id="confirm" 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className="pl-10"
                />
                <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Segurança da conta:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Sua empresa será criada automaticamente após esta etapa.</li>
                <li>Você terá acesso total ao painel administrativo.</li>
                <li>O e-mail de confirmação já foi validado pelo convite.</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              disabled={busy} 
              className="w-full h-11 bg-gradient-primary text-primary-foreground hover:opacity-95 text-base"
            >
              {busy ? "Ativando conta..." : "Ativar minha conta e entrar"}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
