import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  LineChart,
  Lock,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { VejamaisMark } from "@/components/vejamais-logo";
import { Button } from "@/components/ui/button";
import {
  BENEFITS,
  FAQ,
  FEATURED_RESOURCES,
  HERO,
  HOW_IT_WORKS,
  METRIXHR_URL,
  MODULES,
  PAIN_POINTS,
  PLANS,
  SECURITY,
  VEJAMAIS_DOMAIN,
  type Plan,
} from "@/lib/landing-content";

const NAV = [
  { href: "#recursos", label: "Recursos" },
  { href: "#beneficios", label: "Benefícios" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#metrixhr", label: "Metrixhr" },
  { href: "#faq", label: "Perguntas frequentes" },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="conteudo">
        <Hero />
        <Pain />
        <Solution />
        <Benefits />
        <HowItWorks />
        <Features />
        <Plans />
        <Security />
        <Multiempresa />
        <Metrixhr />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Header ---------- */

function Header() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Vejamais — ir para o topo">
          <VejamaisMark size={34} className="rounded-lg shadow-glow" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl">Vejamais</span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Gestão Comercial e Financeira
            </span>
          </div>
        </a>
        <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Navegação principal">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden md:flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {HERO.existingClientCta}
          </Link>
          <Link to="/auth">
            <Button size="sm">{HERO.primaryCta}</Button>
          </Link>
        </div>
        <button
          type="button"
          className="ml-auto md:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-secondary"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3" aria-label="Navegação mobile">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-foreground hover:bg-secondary"
              >
                {n.label}
              </a>
            ))}
            <div className="mt-2 grid gap-2">
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full">{HERO.existingClientCta}</Button>
              </Link>
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button className="w-full gap-1">
                  {HERO.primaryCta} <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1000px 500px at 15% -10%, rgba(34,197,94,0.14), transparent), radial-gradient(800px 400px at 90% 10%, rgba(124,58,237,0.10), transparent)",
        }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[minmax(0,54fr)_minmax(0,46fr)] md:gap-10 md:px-6 md:py-20 lg:py-24">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="size-3.5" /> {HERO.eyebrow}
          </span>
          <h1
            className="mt-5 max-w-[15ch] font-sans text-[2.2rem] font-extrabold text-petrol sm:max-w-[16ch] sm:text-[2.9rem] md:text-[3.4rem] lg:max-w-none lg:text-[4rem] xl:text-[4.35rem]"
            style={{ lineHeight: 1.02, letterSpacing: "-0.035em", fontWeight: 800 }}
          >
            <span className="lg:block">A VEJAMAIS reinventou </span>
            <span className="lg:block">a gestão comercial e financeira </span>
            <span className="lg:block">para seu negócio crescer com </span>
            <span className="lg:block">
              mais <span className="text-primary-deep">controle</span> e{" "}
              <span className="text-primary-deep">rentabilidade</span>.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">{HERO.subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-1.5">
                {HERO.primaryCta} <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#recursos">
              <Button size="lg" variant="outline">{HERO.secondaryCta}</Button>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-primary-deep" /> LGPD by design</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="size-4 text-primary-deep" /> Isolamento por empresa</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-primary-deep" /> Sem cartão para começar</span>
          </div>
        </div>
        <HeroComposition />
      </div>
    </section>
  );
}

function HeroComposition() {
  return (
    <div className="relative mx-auto w-full max-w-md md:max-w-none">
      <div
        aria-hidden
        className="absolute left-1/2 top-[8%] -z-10 aspect-square w-[86%] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle at 50% 45%, #C9F0DA 0%, #DCF3E5 55%, rgba(220,243,229,0) 72%)" }}
      />
      <img
        src={heroGestora}
        width={1024}
        height={1024}
        alt="Gestora brasileira apresentando o Vejamais no smartphone, com indicadores de vendas do mês, saldo atual e lucro em valores fictícios."
        className="relative mx-auto w-full max-w-[420px] select-none md:max-w-none"
        draggable={false}
      />
    </div>
  );
}

function SecondCall() {
  return (
    <section className="bg-mint py-20 md:py-28">
      <div className="mx-auto max-w-[1000px] px-4 text-center md:px-6">
        <h2
          className="text-balance font-sans text-2xl font-extrabold text-petrol sm:text-3xl md:text-[2.6rem]"
          style={{ lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 800 }}
        >
          Funcionalidades para vender melhor, controlar gastos e acompanhar resultados — em uma
          plataforma preparada para crescer com seu negócio.
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-balance text-base text-muted-foreground sm:text-lg">
          Centralize vendas, clientes, produtos, estoque, contas, fluxo de caixa, custos e
          indicadores para administrar sua empresa com mais organização e confiança.
        </p>
      </div>
    </section>
  );
}


/* ---------- Sections ---------- */

function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`py-16 md:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {eyebrow && (
            <span className="inline-block rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {eyebrow}
            </span>
          )}
          <h2 className="mt-3 text-balance font-display text-3xl tracking-tight text-foreground sm:text-4xl">{title}</h2>
          {subtitle && <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
        </div>
        <div className="mt-10 md:mt-14">{children}</div>
      </div>
    </section>
  );
}

function Pain() {
  return (
    <Section
      id="dor"
      eyebrow="A realidade da maioria dos negócios"
      title="Sua empresa trabalha muito, mas você ainda não consegue enxergar com clareza para onde o dinheiro está indo?"
      subtitle="Sem informação organizada, cada decisão vira aposta. Reconhece algum destes cenários?"
    >
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PAIN_POINTS.map((p) => (
          <li
            key={p}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-soft/40"
          >
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Solution() {
  return (
    <Section
      id="recursos"
      eyebrow="A solução"
      title={
        <>
          Funcionalidades para <span className="text-primary">vender melhor</span>,{" "}
          <span className="text-primary">controlar gastos</span> e acompanhar{" "}
          <span className="text-primary">resultados</span> — em uma plataforma preparada para crescer com seu negócio.
        </>
      }
      subtitle="Centralize vendas, clientes, produtos, estoque, contas, fluxo de caixa, custos e indicadores para administrar sua empresa com mais organização e confiança."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <div key={m.name} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <Check className="size-4 text-primary" />
              </span>
              <h3 className="font-medium text-foreground">{m.name}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Benefits() {
  return (
    <Section
      id="beneficios"
      eyebrow="Benefícios"
      title="Clareza que se traduz em rotina."
      subtitle="O que você ganha ao centralizar sua gestão no Vejamais."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-2xl border border-border bg-card p-5">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Check className="size-5" />
            </div>
            <h3 className="mt-3 font-medium text-foreground">{b.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section
      id="como-funciona"
      eyebrow="Como funciona"
      title="Do cadastro à decisão, em poucos passos."
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step} className="relative rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground font-semibold">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-foreground">Etapa {i + 1}</span>
            </div>
            <p className="mt-3 text-sm text-foreground">{step}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Features() {
  return (
    <Section
      eyebrow="Recursos em destaque"
      title="Ferramentas para o seu dia a dia."
      className="bg-secondary/40"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FEATURED_RESOURCES.map((r) => (
          <div key={r.name} className="rounded-xl border border-border bg-card p-4">
            <div className="font-medium text-foreground">{r.name}</div>
            <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- Plans ---------- */

function Plans() {
  return (
    <Section
      id="planos"
      eyebrow="Planos"
      title="Escolha o plano que acompanha o momento da sua empresa."
      subtitle="Valores em definição comercial. Ao criar sua conta você conhece os detalhes atualizados."
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Estrutura comercial em preparação. Nenhum pagamento é processado nesta página.
      </p>
    </Section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const highlight = plan.recommended;
  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border p-6 transition-colors",
        highlight
          ? "border-primary bg-card shadow-glow"
          : "border-border bg-card hover:border-primary/40",
      ].join(" ")}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
          Plano recomendado
        </span>
      )}
      <div>
        <h3 className="font-display text-2xl text-foreground">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      </div>
      <div className="mt-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Mensal</div>
        <div className="mt-1 font-display text-3xl text-foreground">{plan.priceMonthly}</div>
        {plan.priceYearly && (
          <div className="mt-1 text-xs text-muted-foreground">Anual: {plan.priceYearly}</div>
        )}
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        <li className="flex items-center gap-2 text-foreground">
          <Users className="size-4 text-primary" /> {plan.users}
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="size-4 text-primary" /> {plan.companies}
        </li>
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-4" /> {plan.support}
        </li>
      </ul>
      <div className="mt-6">
        {plan.ctaTarget === "/auth" ? (
          <Link to="/auth">
            <Button className="w-full" variant={highlight ? "default" : "outline"} disabled={!plan.available}>
              {plan.cta}
            </Button>
          </Link>
        ) : (
          <a href="#cta-final">
            <Button className="w-full" variant={highlight ? "default" : "outline"}>
              {plan.cta}
            </Button>
          </a>
        )}
        {!plan.available && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Recurso ainda não homologado.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Security ---------- */

function Security() {
  return (
    <Section
      id="seguranca"
      eyebrow="Segurança e LGPD"
      title={SECURITY.title}
      subtitle="Princípios que orientam a arquitetura e a operação do Vejamais."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY.points.map((p) => (
          <div key={p} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="text-sm text-foreground">{p}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Multiempresa() {
  return (
    <section className="pb-4">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="rounded-2xl border border-border bg-card px-6 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Multiempresa:</strong> arquitetura preparada para evolução multiempresa. Liberação sujeita à homologação técnica.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Metrixhr ---------- */

function Metrixhr() {
  return (
    <section id="metrixhr" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-border p-8 md:p-12"
          style={{
            background:
              "linear-gradient(135deg, #0F3D36 0%, #102A2E 55%, #4C1D95 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-30"
            style={{ background: "radial-gradient(closest-side, #A78BFA, transparent)" }}
          />
          <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div className="text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                <Sparkles className="size-3.5" /> Ecossistema parceiro
              </span>
              <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
                Muito além dos números: desenvolva também as pessoas que fazem sua empresa crescer.
              </h2>
              <p className="mt-4 max-w-xl text-sm text-white/80 sm:text-base">
                Enquanto o Vejamais organiza a gestão comercial e financeira, o <strong>Metrixhr</strong> apoia o desenvolvimento humano, o acompanhamento de desempenho, a evolução das equipes e uma gestão de vendas mais consciente, justa e humanizada.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-white/85 sm:grid-cols-2">
                {[
                  "Acompanhamento de desempenho",
                  "Desenvolvimento de equipes",
                  "Avaliações institucionais",
                  "Inteligência aplicada à gestão",
                  "Apoio à liderança",
                  "Cultura de melhoria contínua",
                  "Gestão humanizada",
                  "Decisões com responsabilidade humana",
                  "Proteção da dignidade e privacidade das pessoas",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#A78BFA]" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={METRIXHR_URL} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="gap-1.5 bg-white text-[#0F3D36] hover:bg-white/90">
                    Conhecer o Metrixhr <ArrowRight className="size-4" />
                  </Button>
                </a>
                <a
                  href={METRIXHR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 self-center text-sm text-white/80 hover:text-white underline underline-offset-4"
                >
                  Gestão com Inteligência Humanizada de Vendas
                </a>
              </div>
              <p className="mt-6 text-xs text-white/70">
                Vejamais cuida da clareza do negócio. Metrixhr fortalece as pessoas que constroem os resultados.
              </p>
            </div>
            <div className="hidden md:block">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.16em] text-white/70">Marca parceira</div>
                <div className="mt-2 font-display text-4xl text-white">Metrixhr</div>
                <div className="mt-1 text-sm text-white/80">
                  Gestão com Inteligência Humanizada de Vendas
                </div>
                <div className="mt-5 h-px w-full bg-white/15" />
                <div className="mt-5 text-xs text-white/70">
                  Conexão institucional entre soluções. Sem SSO, sem compartilhamento automático de dados ou de sessão entre as plataformas.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

function Faq() {
  return (
    <Section id="faq" eyebrow="Perguntas frequentes" title="Boas dúvidas, respostas claras.">
      <div className="mx-auto max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {FAQ.map((f, i) => (
          <FaqItem key={i} question={f.q} answer={f.a} />
        ))}
      </div>
    </Section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/40"
      >
        <span className="text-sm font-medium text-foreground">{question}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 text-sm text-muted-foreground">{answer}</div>}
    </div>
  );
}

/* ---------- Final CTA ---------- */

function FinalCta() {
  return (
    <section id="cta-final" className="pb-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div
          className="rounded-3xl border border-border p-10 text-center md:p-14"
          style={{ background: "linear-gradient(135deg, #F1FAF5 0%, #DCF3E5 100%)" }}
        >
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Sua empresa merece mais clareza para crescer com segurança.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Organize vendas, finanças, contas e resultados com o Vejamais.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-1.5">
                Entrar <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#planos">
              <Button size="lg" variant="outline">Ver planos</Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <VejamaisMark size={32} className="rounded-lg" />
            <div className="flex flex-col leading-none">
              <span className="font-display text-xl">Vejamais</span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Gestão Comercial e Financeira
              </span>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Centralize vendas, produtos, clientes, fornecedores, contas, fluxo de caixa e resultados em uma plataforma preparada para apoiar decisões conscientes.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            <a href={VEJAMAIS_DOMAIN} className="hover:text-foreground">{VEJAMAIS_DOMAIN.replace("https://", "")}</a>
          </p>
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">Plataforma</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-foreground">Entrar</Link></li>
            <li><a href="#recursos" className="hover:text-foreground">Recursos</a></li>
            <li><a href="#planos" className="hover:text-foreground">Planos</a></li>
            <li><a href="#seguranca" className="hover:text-foreground">Segurança</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">Ecossistema</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href={METRIXHR_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                Metrixhr
              </a>
            </li>
            <li><a href="#faq" className="hover:text-foreground">Perguntas frequentes</a></li>
            <li><a href="#cta-final" className="hover:text-foreground">Contato</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <div>© {year} Vejamais — Gestão Comercial e Financeira. Todos os direitos reservados.</div>
          <div className="flex gap-4">
            <a href="#seguranca" className="hover:text-foreground">Privacidade</a>
            <a href="#seguranca" className="hover:text-foreground">Termos</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
