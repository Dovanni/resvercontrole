import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — Vejamais" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [busy, setBusy] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    
    // 1. SignUp
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { nome_empresa: empresaNome, cnpj }
      }
    });

    if (authError) {
      toast.error(translateAuthError(authError.message));
      setBusy(false);
      return;
    }

    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    setBusy(false);
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <VejamaisMark size={64} className="mx-auto mb-4 rounded-2xl shadow-glow" />
          <h1 className="font-display text-4xl text-foreground">Criar minha empresa</h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gestão Comercial e Financeira</p>
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-8">
          <form onSubmit={signUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Nome da Empresa</Label>
              <Input id="empresa" required value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email do Administrador</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar Senha</Label>
                <Input id="confirm" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95">
              Criar conta
            </Button>
            <div className="text-center mt-4 text-sm text-muted-foreground">
              Já tem uma conta? <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
            </div>
            <div className="pt-4 flex justify-center">
              <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o Vejamais
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
