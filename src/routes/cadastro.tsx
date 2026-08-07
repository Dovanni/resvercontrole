import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { useServerFn } from "@tanstack/react-start";
import { secureSignUp } from "@/lib/auth-security.functions";
import { TurnstileWidget, TurnstileWidgetRef } from "@/components/turnstile-widget";
import { useRef } from "react";
import { MathChallengeField } from "@/components/math-challenge";

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
  const [nomeAdmin, setNomeAdmin] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  
  const [mathToken, setMathToken] = useState("");
  const [mathAnswer, setMathAnswer] = useState("");
  
  const signUpFn = useServerFn(secureSignUp);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      toast.error("Você precisa aceitar os termos e a política de privacidade.");
      return;
    }

    setBusy(true);
    
    try {
      if (!turnstileToken) {
        toast.error("Por favor, resolva o desafio de segurança.");
        setBusy(false);
        return;
      }
      
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken: turnstileToken,
          data: {
            nome_empresa: empresaNome,
            cnpj,
            nome_administrador: nomeAdmin,
            consentimento_termos: true,
            consentimento_privacidade: true,
            data_consentimento: new Date().toISOString()
          }
        }
      });

      if (authError) throw authError;

      // Opcional: Manter chamada à server fn se houver lógica adicional necessária (como logs)
      // mas a criação do usuário já foi feita acima.
      // Se a server function 'secureSignUp' for necessária para lógica extra (ex: tabelas de empresa),
      // ela deve ser chamada, mas agora sabemos que o auth.signUp tratou o token.
      
      // Para este projeto, o cadastro multiempresa é trigado por hooks no banco após o signup,
      // ou a server fn faz a gestão de tabelas. Vamos manter a consistência com a instrução:
      // "enviar o token do Turnstile em options.captchaToken nas operações de signup"

      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate({ to: "/login" });
    } catch (error: any) {
      if (error.message.includes("TURNSTILE_CONFIGURATION_REQUIRED")) {
        toast.error("Configuração de segurança necessária (TURNSTILE_SITE_KEY).");
      } else {
        toast.error(error.message || "Erro ao criar conta.");
      }
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setBusy(false);
    }
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin_name">Nome do Administrador</Label>
              <Input 
                id="admin_name" 
                required 
                placeholder="Seu nome completo"
                value={nomeAdmin} 
                onChange={(e) => setNomeAdmin(e.target.value)} 
              />
            </div>

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

            <div className="space-y-4 py-2 border-t border-b border-border/50">
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={acceptTerms} 
                  onCheckedChange={(v) => setAcceptTerms(!!v)} 
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Aceito os Termos de Uso
                  </label>
                  <a href="/termos" target="_blank" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                    Ler termos <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="privacy" 
                  checked={acceptPrivacy} 
                  onCheckedChange={(v) => setAcceptPrivacy(!!v)} 
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="privacy"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Aceito a Política de Privacidade
                  </label>
                  <a href="/privacidade" target="_blank" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                    Ler política <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>

            <MathChallengeField onVerify={(t, a) => { setMathToken(t); setMathAnswer(a); }} />

            <TurnstileWidget 
              ref={turnstileRef} 
              onVerify={setTurnstileToken} 
            />

            <Button 
              type="submit" 
              disabled={busy || (import.meta.env.VITE_TURNSTILE_SITE_KEY ? !turnstileToken : true)} 
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95"
            >
              {busy ? "Processando..." : "Criar conta"}
            </Button>
            
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              Este site é protegido pelo Cloudflare Turnstile.
            </p>

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
