import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { useServerFn } from "@tanstack/react-start";
import { secureRequestPasswordReset } from "@/lib/recovery-security.functions";
import { RecaptchaV2, RecaptchaV2Ref } from "@/components/recaptcha-v2";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — Vejamais" }] }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaV2Ref>(null);

  const requestResetFn = useServerFn(secureRequestPasswordReset);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Por favor, informe seu e-mail.");
      return;
    }

    if (!recaptchaToken) {
      toast.error("Por favor, marque 'Não sou um robô'.");
      return;
    }

    setBusy(true);

    try {
      await requestResetFn({
        data: {
          email,
          recaptchaToken,
        }
      });
      
      toast.success("Se existir uma conta com esse e-mail, enviaremos as orientações.");
      // Opcional: redirecionar ou limpar
      setEmail("");
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } catch (error: any) {
      if (error.message === "RECAPTCHA_CONFIGURATION_REQUIRED") {
        toast.error("Configuração de segurança necessária (RECAPTCHA_CONFIGURATION_REQUIRED).");
      } else {
        // Mensagem genérica para proteção contra enumeração, mas permitimos erros de validação técnica
        toast.success("Se existir uma conta com esse e-mail, enviaremos as orientações.");
      }
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
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
            VEJAMAIS
          </h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gestão Comercial e Financeira</p>
        </div>

        <div className="rounded-2xl bg-card shadow-soft border p-6">
          <h2 className="font-display text-2xl text-foreground text-center mb-6">Recuperar senha</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="seu@email.com"
              />
            </div>

            <RecaptchaV2 
              ref={recaptchaRef} 
              onVerify={setRecaptchaToken} 
            />

            <Button 
              type="submit" 
              disabled={busy || (import.meta.env.VITE_RECAPTCHA_SITE_KEY ? !recaptchaToken : true)} 
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95"
            >
              {busy ? "Enviando..." : "Enviar orientações"}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground pt-4 border-t">
              Lembrou sua senha? <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
            </div>
            
            <div className="pt-2 flex justify-center mt-2">
              <Link
                to="/"
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
