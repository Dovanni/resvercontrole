import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { 
  ArrowLeft, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Search, 
  Loader2, 
  HelpCircle,
  Check,
  LayoutDashboard,
  Rocket,
  Settings2,
  BarChart3,
  Globe
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { VejamaisMark } from "@/components/vejamais-logo";
import { useServerFn } from "@tanstack/react-start";
import { secureSignUp, completeSignUpSuccess } from "@/lib/auth-security.functions";
import { TurnstileWidget, TurnstileWidgetRef } from "@/components/turnstile-widget";
import { MathChallengeField } from "@/components/math-challenge";
import { validateCompanyCnpj, type CompanyValidationResult } from "@/lib/company-validation.functions";
import { formatCnpj, normalizeCnpj } from "@/lib/cnpj-validator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — Vejamais" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [nomeAdmin, setNomeAdmin] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validatingCnpj, setValidatingCnpj] = useState(false);
  const [validatedData, setValidatedData] = useState<CompanyValidationResult | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  
  const [mathToken, setMathToken] = useState("");
  const [mathAnswer, setMathAnswer] = useState("");
  
  const signUpFn = useServerFn(secureSignUp);
  const completeSignUpFn = useServerFn(completeSignUpSuccess);
  const validateCnpjFn = useServerFn(validateCompanyCnpj);
  
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
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

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setCnpj(formatCnpj(value));
    if (validatedData) setValidatedData(null);
  };

  const handleValidateCnpj = async () => {
    if (!cnpj) {
      toast.error("Informe o CNPJ para validar.");
      return;
    }

    setValidatingCnpj(true);
    try {
      const result = await validateCnpjFn({ data: { cnpj } });
      setValidatedData(result);
      setEmpresaNome(result.nome_fantasia || result.razao_social);
      toast.success("CNPJ validado com sucesso!");
    } catch (error: any) {
      console.error("CNPJ Validation Error:", error);
      let errorData;
      try {
        errorData = JSON.parse(error.message);
      } catch {
        errorData = { error: "Erro inesperado", reason_code: "UNKNOWN" };
      }

      if (errorData.error === "EXISTING_COMPANY" || errorData.reason_code === "DUPLICATE_COMPANY") {
        toast.error("Esta empresa já está cadastrada no VEJAMAIS. Solicite acesso ao administrador da conta.");
      } else if (errorData.error === "PROVIDER_ALPHANUMERIC_NOT_SUPPORTED" || errorData.reason_code === "ALPHANUMERIC_NOT_SUPPORTED") {
        toast.info("O CNPJ é estruturalmente válido, mas a consulta cadastral alfanumérica está temporariamente indisponível. Fale com nosso suporte pelo WhatsApp para concluir o cadastro.", {
          duration: 10000,
        });
      } else {
        toast.error(errorData.error || "Erro ao validar CNPJ.");
      }
      
      if (errorData.trace_id) {
        console.log(`Trace ID: ${errorData.trace_id}`);
      }
    } finally {
      setValidatingCnpj(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validatedData) {
      toast.error("Por favor, valide o CNPJ antes de continuar.");
      return;
    }

    if (validatedData.situacao_cadastral !== "ATIVA") {
      toast.error("Somente empresas com situação cadastral ATIVA podem se cadastrar automaticamente.");
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
      
      const result = await signUpFn({
        data: {
          email: email.trim(),
          empresaNome: empresaNome.trim(),
          cnpj: normalizeCnpj(cnpj),
          nomeAdmin: nomeAdmin.trim(),
          turnstileToken,
          mathChallengeToken: mathToken,
          mathChallengeAnswer: mathAnswer,
          consent: { termos: acceptTerms, privacidade: acceptPrivacy }
        }
      });

      await completeSignUpFn({ data: { email: email.trim() } });

      toast.success(result.message || "Solicitação enviada! Verifique seu e-mail.");
      navigate({ to: "/login" });
    } catch (error: any) {
      try {
        const parsedError = JSON.parse(error.message);
        if (parsedError.code === "RATE_LIMITED") {
          setRetryAfter(parsedError.retryAfterSeconds);
          toast.error(parsedError.message);
        } else {
          toast.error(parsedError.message || error.message || "Erro ao criar conta.");
        }
      } catch {
        toast.error(error.message || "Erro ao criar conta.");
      }
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-rose flex items-center justify-center px-4 py-12 relative overflow-x-hidden">
      {/* Marketplace & E-commerce Ecosystem - Desktop Sidebars */}
      <div className="hidden lg:block absolute left-8 top-1/2 -translate-y-1/2 w-56 space-y-6 opacity-40 hover:opacity-100 transition-opacity duration-500" aria-hidden="true">
        <div className="mb-8 p-6 rounded-2xl bg-primary text-primary-foreground shadow-glow border border-primary/20 scale-110 transform origin-left">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="size-6" />
            <h3 className="font-display text-lg font-bold">Meu e-commerce</h3>
          </div>
          <p className="text-xs font-medium opacity-90 leading-tight">Loja virtual própria</p>
        </div>
        
        <div className="space-y-4 pt-4 border-t border-primary/10">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-3">Canais próprios</p>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2"><Check className="size-3 text-primary" /> Loja física</p>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2"><Check className="size-3 text-primary" /> Redes sociais</p>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2"><Check className="size-3 text-primary" /> Venda direta</p>
          </div>
        </div>

        <div className="pt-6 border-t border-primary/10">
          <p className="text-[10px] font-medium text-muted-foreground leading-tight">
            Do seu e-commerce próprio aos marketplaces: acompanhe todos os canais do seu negócio com a VEJAMAIS.
          </p>
        </div>
      </div>

      <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 w-48 space-y-4 opacity-40 hover:opacity-100 transition-opacity duration-500 text-right" aria-hidden="true">
        <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-4">Marketplaces e Serviços</p>
        <div className="flex justify-end"><MarketplaceChip name="Mercado Livre" color="bg-[#FFE600] text-black" size="sm" /></div>
        <div className="flex justify-end"><MarketplaceChip name="Amazon" color="bg-[#232F3E] text-white" size="sm" /></div>
        <div className="flex justify-end"><MarketplaceChip name="Shopee" color="bg-[#EE4D2D] text-white" size="sm" /></div>
        <div className="flex justify-end"><MarketplaceChip name="Magalu" color="bg-[#0086FF] text-white" size="sm" /></div>
        <div className="flex justify-end"><MarketplaceChip name="SHEIN" color="bg-black text-white" size="sm" /></div>
        <div className="flex justify-end"><MarketplaceChip name="Temu" color="bg-[#FF6000] text-white" size="sm" /></div>
        <div className="flex justify-end pt-2">
          <div className="text-[10px] py-1 px-3 rounded-full bg-muted border border-border text-muted-foreground font-medium">
            Serviço: Mercado Pago
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-8">
          <VejamaisMark size={64} className="mx-auto mb-4 rounded-2xl shadow-glow" />
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="font-display text-4xl text-foreground">Criar minha empresa</h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  aria-haspopup="dialog"
                  title="Como funciona esta etapa?"
                >
                  <HelpCircle className="h-5 w-5" />
                  <span className="sr-only">Como funciona esta etapa?</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
                <ScrollArea className="max-h-[90vh]">
                  <div className="p-8">
                    <DialogHeader className="mb-8">
                      <DialogTitle className="text-3xl font-display text-primary mb-4 leading-tight">
                        Comece a organizar a gestão do seu negócio
                      </DialogTitle>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        Cadastre sua empresa para centralizar o acompanhamento comercial e financeiro do seu e-commerce próprio, da sua loja virtual, das vendas em marketplaces e dos demais canais do negócio. Após criar sua conta, você poderá organizar pedidos, vendas, produtos, estoque, clientes, fornecedores, contas, fluxo de caixa, custos, margens e resultados em um só lugar.
                      </p>
                    </DialogHeader>

                    <div className="grid gap-8 mb-10">
                      <div className="grid sm:grid-cols-2 gap-6">
                        <StepItem 
                          number="1" 
                          icon={<Building2 className="size-5" />}
                          title="Cadastre sua empresa"
                          description="Informe os dados básicos do administrador e da empresa. O CNPJ será validado antes da confirmação do cadastro."
                        />
                        <StepItem 
                          number="2" 
                          icon={<Rocket className="size-5" />}
                          title="Inicie sua avaliação gratuita"
                          description="Tenha acesso aos recursos da VEJAMAIS durante o período de avaliação, conforme as condições comerciais vigentes."
                        />
                        <StepItem 
                          number="3" 
                          icon={<Settings2 className="size-5" />}
                          title="Organize sua operação"
                          description="Cadastre os produtos, clientes, fornecedores, contas bancárias e informações das vendas realizadas no e-commerce próprio, nos marketplaces e nos demais canais do negócio."
                        />
                        <StepItem 
                          number="4" 
                          icon={<BarChart3 className="size-5" />}
                          title="Registre e acompanhe resultados"
                          description="Monitore vendas, estoque, taxas, fretes, despesas, contas a pagar e receber, fluxo de caixa, margens, lucros, relatórios, BI e DRE."
                        />
                      </div>
                    </div>

                    <div className="bg-primary/5 rounded-2xl p-6 mb-8 border border-primary/10">
                      <h3 className="font-display text-xl text-primary mb-4 flex items-center gap-2">
                        <CheckCircle2 className="size-5" />
                        Por que utilizar a VEJAMAIS?
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4">
                        {[
                          "Gestão comercial e financeira centralizada",
                          "Acompanhamento do e-commerce próprio e de outros canais de venda",
                          "Acompanhamento de pedidos, vendas e recebimentos",
                          "Controle de produtos e estoque",
                          "Organização de pedidos, produtos, estoque, taxas e fretes",
                          "Organização de taxas, fretes, custos e despesas",
                          "Visibilidade sobre margens e lucros",
                          "Contas a pagar, receber e fluxo de caixa",
                          "Relatórios avançados, BI e DRE",
                          "Visão consolidada da operação comercial e financeira",
                          "Clareza para decidir e segurança para crescer"
                        ].map((benefit) => (
                          <div key={benefit} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="size-4 text-primary mt-0.5 shrink-0" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-center font-medium text-primary/80 mb-8 italic">
                      “A VEJAMAIS ajuda a transformar os dados da operação em uma visão mais clara do desempenho comercial e financeiro do seu negócio.”
                    </p>

                    <div className="flex justify-center">
                      <DialogClose asChild>
                        <Button className="px-8 bg-gradient-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20">
                          Entendi, continuar cadastro
                        </Button>
                      </DialogClose>
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gestão Comercial e Financeira</p>
          
          <div className="mt-6 space-y-1">
            <h2 className="text-primary font-semibold text-lg">Gestão comercial e financeira para e-commerce e comércio</h2>
            <p className="text-sm text-muted-foreground px-4">
              Organize em um só lugar os resultados do seu e-commerce próprio, da sua loja virtual, dos marketplaces e dos demais canais de venda do seu negócio.
            </p>
            <p className="text-sm text-muted-foreground px-4">
              Da venda realizada no seu próprio site às operações em diferentes plataformas, acompanhe pedidos, produtos, estoque, taxas, fretes, contas, margens e lucros com mais clareza.
            </p>
          </div>
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
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ da empresa</Label>
              <div className="flex gap-2">
                <Input 
                  id="cnpj" 
                  placeholder="00.000.000/0000-00" 
                  value={cnpj} 
                  onChange={handleCnpjChange} 
                  disabled={busy || validatingCnpj}
                  className="font-mono"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleValidateCnpj}
                  disabled={busy || validatingCnpj || !cnpj}
                  className="shrink-0"
                >
                  {validatingCnpj ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Validar
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Suporta CNPJ numérico e alfanumérico (2026).</p>
            </div>

            {validatedData && (
              <Card className="bg-muted/30 border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="text-[10px] font-medium text-muted-foreground">Dados cadastrais consultados via BrasilAPI. Confirme as informações antes de continuar.</span>
                    </div>
                    {validatedData.situacao_cadastral === "ATIVA" ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 px-2 py-0">
                        <CheckCircle2 className="h-3 w-3" /> {validatedData.situacao_cadastral}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1 px-2 py-0">
                        <AlertTriangle className="h-3 w-3" /> {validatedData.situacao_cadastral}
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Razão Social</Label>
                      <p className="text-sm font-semibold truncate">{validatedData.razao_social}</p>
                    </div>
                    {validatedData.nome_fantasia && (
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Nome Fantasia</Label>
                        <p className="text-sm font-medium">{validatedData.nome_fantasia}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Data de Abertura</Label>
                        <p className="text-sm font-medium">{validatedData.data_abertura}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Município / UF</Label>
                        <p className="text-sm font-medium">{validatedData.municipio} - {validatedData.uf}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Natureza Jurídica</Label>
                      <p className="text-xs text-muted-foreground line-clamp-1">{validatedData.natureza_juridica}</p>
                    </div>
                  </div>

                  {validatedData.situacao_cadastral !== "ATIVA" && (
                    <div className="pt-2 mt-2 border-t border-destructive/10">
                      <p className="text-[10px] text-destructive leading-tight mb-2">
                        A situação cadastral desta empresa não permite a ativação automática. Entre em contato com nosso suporte.
                      </p>
                      <Button variant="outline" size="sm" className="w-full text-[10px] h-7 gap-1.5" asChild>
                        <a href="https://wa.me/5517992822622?text=Olá!%20Minha%20empresa%20está%20com%20situação%20irregular%20e%20gostaria%20de%20ajuda%20para%20usar%20o%20VEJAMAIS." target="_blank">
                          Suporte via WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label htmlFor="empresa">Nome de Exibição da Empresa</Label>
              <Input 
                id="empresa" 
                required 
                value={empresaNome} 
                onChange={(e) => setEmpresaNome(e.target.value)} 
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email do Administrador</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={busy}
              />
            </div>

            <div className="space-y-4 py-2 border-t border-b border-border/50">
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={acceptTerms} 
                  onCheckedChange={(v) => setAcceptTerms(!!v)} 
                  disabled={busy}
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
                  disabled={busy}
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

            <div 
              aria-live="polite" 
              className="text-center p-3 rounded-lg bg-muted/50 text-sm font-medium"
            >
              {retryAfter !== null && retryAfter > 0 ? (
                <span className="text-destructive">
                  Muitas tentativas de cadastro. Aguarde {formatTime(retryAfter)} para tentar novamente.
                </span>
              ) : retryAfter === 0 || (retryAfter === null && busy === false && turnstileToken === null && mathToken === "") ? (
                null
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
              disabled={busy || !validatedData || validatedData.situacao_cadastral !== "ATIVA" || retryAfter !== null || (import.meta.env.VITE_TURNSTILE_SITE_KEY ? !turnstileToken : true)} 
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-95"
            >
              {busy ? "Processando..." : validatedData ? "Confirmar dados e cadastrar empresa" : "Valide o CNPJ primeiro"}
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

        {/* Marketplace Ecosystem - Mobile/Tablet Footer */}
        <div className="lg:hidden mt-12 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-sm font-semibold text-primary">Seu negócio vende em diferentes canais?</h3>
            <p className="text-xs text-muted-foreground">Centralize o acompanhamento na VEJAMAIS.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MarketplaceChip name="Mercado Livre" color="bg-[#FFE600] text-black" size="sm" />
            <MarketplaceChip name="Amazon" color="bg-[#232F3E] text-white" size="sm" />
            <MarketplaceChip name="Shopee" color="bg-[#EE4D2D] text-white" size="sm" />
            <MarketplaceChip name="Magalu" color="bg-[#0086FF] text-white" size="sm" />
            <MarketplaceChip name="Mercado Pago" color="bg-[#009EE3] text-white" size="sm" />
            <MarketplaceChip name="SHEIN" color="bg-black text-white" size="sm" />
            <MarketplaceChip name="Temu" color="bg-[#FF6000] text-white" size="sm" />
          </div>
        </div>

        <div className="mt-8 text-center px-4">
          <p className="text-[9px] text-muted-foreground leading-relaxed max-w-md mx-auto">
            Marcas citadas pertencem aos seus respectivos titulares. A exibição representa canais de venda utilizados por empresas e não implica parceria, afiliação ou integração automática com a VEJAMAIS.
          </p>
        </div>
      </div>
    </div>
  );
}

function MarketplaceChip({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" }) {
  return (
    <div className={cn(
      "flex items-center justify-center rounded-xl shadow-sm border border-white/10 transition-transform hover:scale-105 select-none font-bold tracking-tight",
      color,
      size === "md" ? "h-12 px-6 text-sm" : "h-10 px-4 text-xs"
    )}>
      {name}
    </div>
  );
}

function StepItem({ number, icon, title, description }: { number: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-primary/5 bg-white/50">
      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary/50 uppercase tracking-wider">Passo {number}</span>
          <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

