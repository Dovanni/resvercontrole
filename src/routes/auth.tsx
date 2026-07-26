import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Vejamais" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState<{ name: string; logo: string }>({ name: "", logo: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rose:brand");
      if (raw) setBrand(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  // Public signup temporarily disabled: any attempt to reach /auth with a
  // signup intent (query string, hash, deep link) is normalized to sign-in
  // and the user is notified once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const q = url.searchParams;
    const hash = (url.hash || "").toLowerCase();
    const signupIntent =
      q.get("mode") === "signup" ||
      q.get("tab") === "signup" ||
      q.has("signup") ||
      q.has("register") ||
      q.has("cadastro") ||
      hash.includes("signup") ||
      hash.includes("register") ||
      hash.includes("cadastro");
    if (signupIntent) {
      toast.info("O cadastro de novas contas está temporariamente indisponível.");
      ["mode", "tab", "signup", "register", "cadastro"].forEach((k) => q.delete(k));
      const clean = url.pathname + (q.toString() ? `?${q}` : "");
      window.history.replaceState({}, "", clean);
    }
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Bem-vinda de volta!");
  }

  async function handleForgot() {
    if (!email) {
      toast.error("Digite seu email no campo acima e clique em 'Esqueci minha senha' novamente.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Enviamos um link de redefinição para seu email. Verifique também a caixa de spam.");
  }

  return (
    <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {brand.logo ? (
            <img src={brand.logo} alt={brand.name || "Vejamais"} className="mx-auto mb-4 max-h-20 w-auto object-contain rounded-2xl" />
          ) : (
            <div className="mx-auto mb-4 flex justify-center">
              <VejamaisMark size={64} className="rounded-2xl shadow-glow" />
            </div>
          )}
          <h1 className="font-display text-4xl text-foreground">
            {brand.name || "Vejamais"}
          </h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gestão Comercial e Financeira</p>
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-6">
          <h2 className="font-display text-2xl text-foreground text-center mb-6">Entrar</h2>
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="e1">Email</Label>
              <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p1">Senha</Label>
              <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95">
              Entrar
            </Button>
            <button
              type="button"
              onClick={handleForgot}
              disabled={busy}
              className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Esqueci minha senha
            </button>
            <div className="pt-1 flex justify-center">
              <Link
                to="/"
                aria-label="Voltar para o Vejamais"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Voltar para o Vejamais
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
