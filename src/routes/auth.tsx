import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { VejamaisLogo, VejamaisMark } from "@/components/vejamais-logo";
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
  const [name, setName] = useState("");
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

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Bem-vinda de volta!");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Conta criada! Você já pode usar.");
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
            <img src={brand.logo} alt={brand.name || "Logo"} className="mx-auto mb-4 max-h-20 w-auto object-contain rounded-2xl" />
          ) : (
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-primary shadow-glow mb-4">
              <Sparkles className="size-6 text-primary-foreground" />
            </div>
          )}
          <h1 className="font-display text-4xl text-foreground">
            {brand.name || "Vejamais"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Gestão comercial e financeira do seu negócio</p>
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
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
              </form>

            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="n2">Seu nome</Label>
                  <Input id="n2" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e2">Email</Label>
                  <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p2">Senha</Label>
                  <Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95">
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
