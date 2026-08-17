// VEJAMAIS_PUBLIC_SIGNUP_ADMIN_NAME_CONTRACT_CORRECTED
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { translateAuthError } from "@/lib/auth-errors";
import { TurnstileWidget, TurnstileWidgetRef } from "@/components/turnstile-widget";
import { useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { secureSignIn, completeSignInSuccess } from "@/lib/auth-security.functions";
import { MathChallengeField } from "@/components/math-challenge";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — VEJAMAIS ERP" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [mathToken, setMathToken] = useState("");
  const [mathAnswer, setMathAnswer] = useState("");

  const signInSecurityFn = useServerFn(secureSignIn);
  const completeSignInFn = useServerFn(completeSignInSuccess);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/dashboard" });
    }
  }, [session, loading, navigate]);

  const mathChallengeRef = useRef<{ refresh: () => void }>(null);

  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;

    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          mathChallengeRef.current?.refresh();
          turnstileRef.current?.reset();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [retryAfter]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      if (!turnstileToken) {
        toast.error("Por favor, resolva o desafio de segurança.");
        setBusy(false);
        return;
      }

      if (!mathToken || !mathAnswer) {
        toast.error("Por favor, resolva o desafio matemático.");
        setBusy(false);
        return;
      }

      // 1. Validar precondições de segurança no servidor (Math -> Turnstile)
      await signInSecurityFn({
        data: {
          email,
          password,
          turnstileToken,
          mathChallengeToken: mathToken,
          mathChallengeAnswer: mathAnswer,
        }
      });

      // 2. Se a segurança passou, prosseguir com o login real (sem captchaToken nativo)
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password
      });
      
      if (error) {
        toast.error("Não foi possível entrar com os dados informados.");
      } else {
        await completeSignInFn({ data: { email: email.trim() } });
        
        // Verificar onboarding pendente antes do dashboard
        const { data: onboarding } = await supabase
          .from('pending_onboardings' as any)
          .select('id')
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (onboarding) {
          toast.success("Login realizado. Complete sua ativação.");
          navigate({ to: "/ativar-conta", replace: true });
        } else {
          toast.success("Bem-vinda de volta!");
          navigate({ to: "/dashboard", replace: true });
        }
      }
    } catch (error: any) {
      try {
        const parsedError = JSON.parse(error.message);
        if (parsedError.code === "RATE_LIMITED") {
          setRetryAfter(parsedError.retryAfterSeconds);
          toast.error(parsedError.message);
        } else {
          toast.error(parsedError.message || error.message || "Erro de segurança.");
        }
      } catch {
        if (error.message.includes("TURNSTILE")) {
          toast.error("Erro na verificação de segurança.");
        } else {
          toast.error(error.message || "Não foi possível entrar com os dados informados.");
        }
      }
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <VejamaisMark size={64} className="rounded-2xl shadow-glow" />
          </div>
          <h1 className="font-display text-4xl text-foreground">
            VEJAMAIS ERP
          </h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gestão Comercial e Financeira — VEJAMAIS ERP</p>
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-6">
          <h2 className="font-display text-2xl text-foreground text-center mb-6">Entrar</h2>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div 
              aria-live="polite" 
              className="text-center p-3 rounded-lg bg-muted/50 text-sm font-medium"
            >
              {retryAfter !== null && retryAfter > 0 ? (
                <span className="text-destructive">
                  Muitas tentativas de acesso. Aguarde {formatTime(retryAfter)} para tentar novamente.
                </span>
              ) : retryAfter === 0 || (retryAfter === null && busy === false && turnstileToken === null && mathToken === "") ? (
                retryAfter === null && busy === false && turnstileToken === null && mathToken === "" ? null : (
                  <span className="text-primary">Você já pode tentar novamente</span>
                )
              ) : null}
            </div>

            <MathChallengeField 
              ref={mathChallengeRef}
              onVerify={(t, a) => { setMathToken(t); setMathAnswer(a); }} 
            />

            <TurnstileWidget 
              ref={turnstileRef} 
              onVerify={setTurnstileToken} 
            />

            <Button 
              type="submit" 
              disabled={busy || retryAfter !== null || (import.meta.env.VITE_TURNSTILE_SITE_KEY ? !turnstileToken : true)} 
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95"
            >
              {busy ? "Entrando..." : "Entrar"}
            </Button>
            
            <Link
              to="/recuperar-senha"
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Esqueci minha senha
            </Link>
            
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              Este site é protegido pelo Cloudflare Turnstile.
            </p>

            <div className="text-center text-sm text-muted-foreground pt-2">
              Ainda não tem conta? <Link to="/cadastro" className="text-primary hover:underline font-medium">Começar agora</Link>
            </div>
            <div className="pt-2 flex justify-center border-t mt-4">
              <Link
                to="/"
                aria-label="Voltar para a homepage da VEJAMAIS ERP"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Voltar para o VEJAMAIS ERP
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
