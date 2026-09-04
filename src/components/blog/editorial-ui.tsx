import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Building2, ChevronRight, Clock3, Search, ShieldCheck, Sparkles, Warehouse } from "lucide-react";
import { VejamaisLogo, VejamaisMark } from "@/components/vejamais-logo";
import { Button } from "@/components/ui/button";
import type { BlogArticle } from "@/features/blog/types";

export function BlogHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
        <Link to="/" className="shrink-0" aria-label="VEJAMAIS ERP — página inicial">
          <VejamaisLogo variant="compact" />
        </Link>
        <div className="hidden h-7 w-px bg-border md:block" aria-hidden="true" />
        <Link to="/blog" className="hidden text-sm font-semibold text-foreground md:block">
          Editorial
        </Link>
        <nav className="ml-auto flex items-center gap-2 sm:gap-4" aria-label="Navegação editorial">
          <Link to="/blog" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
            Artigos
          </Link>
          <Link to="/login" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex">
            Entrar
          </Link>
          <Link to="/cadastro">
            <Button size="sm" className="gap-1.5">
              Conhecer o ERP <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function BlogFooter() {
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1fr_auto] md:items-end md:px-6">
        <div>
          <VejamaisLogo showTagline />
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Conteúdo editorial sobre gestão financeira, vendas, estoque, processos, segurança e administração multiempresa.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground md:justify-end">
          <Link to="/blog" className="hover:text-foreground">Blog</Link>
          <Link to="/" className="hover:text-foreground">VEJAMAIS ERP</Link>
          <Link to="/login" className="hover:text-foreground">Entrar</Link>
        </div>
      </div>
    </footer>
  );
}

export function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BlogHeader />
      {children}
      <BlogFooter />
    </div>
  );
}

function categoryIcon(category: string) {
  if (category.includes("Financeira")) return <Sparkles className="size-5" />;
  if (category.includes("Estoque")) return <Warehouse className="size-5" />;
  if (category.includes("Multiempresa")) return <Building2 className="size-5" />;
  if (category.includes("Segurança")) return <ShieldCheck className="size-5" />;
  return <BookOpen className="size-5" />;
}

export function EditorialVisual({ article, compact = false }: { article: BlogArticle; compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label={article.featuredImageAlt}
      className={`relative overflow-hidden border-b bg-mint ${compact ? "min-h-40" : "min-h-64 rounded-3xl border"}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(480px 220px at 15% 15%, rgba(34,197,94,0.20), transparent), radial-gradient(420px 240px at 92% 88%, rgba(124,58,237,0.10), transparent)",
        }}
      />
      <div className="relative flex h-full min-h-inherit items-center justify-between gap-6 p-6 sm:p-8">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1.5 text-xs font-semibold text-petrol shadow-sm backdrop-blur">
            {categoryIcon(article.category)} {article.category}
          </span>
          <p className={`mt-5 max-w-lg font-display font-semibold text-petrol ${compact ? "text-xl" : "text-2xl sm:text-3xl"}`}>
            {article.focusKeyword}
          </p>
        </div>
        <div className="hidden shrink-0 sm:block" aria-hidden="true">
          <div className="rounded-[28px] border border-primary/15 bg-white/75 p-5 shadow-sm backdrop-blur">
            <VejamaisMark size={compact ? 54 : 72} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditorialArticleCard({ article, featured = false }: { article: BlogArticle; featured?: boolean }) {
  return (
    <article className={`group overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${featured ? "lg:grid lg:grid-cols-[1.05fr_0.95fr]" : "flex flex-col"}`}>
      <EditorialVisual article={article} compact={!featured} />
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span>{article.category}</span>
          <span aria-hidden="true">•</span>
          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
            <Clock3 className="size-3.5" /> {article.readingTimeMinutes} min de leitura
          </span>
        </div>
        <h2 className={`mt-4 font-display font-semibold leading-tight text-foreground ${featured ? "text-3xl md:text-4xl" : "text-2xl"}`}>
          {article.title}
        </h2>
        <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{article.excerpt}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {article.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{tag}</span>
          ))}
        </div>
        <Link
          to="/blog/$slug"
          params={{ slug: article.slug }}
          className="mt-6 inline-flex items-center gap-1.5 self-start font-semibold text-primary transition-colors hover:text-primary-deep"
        >
          Ler artigo <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

export function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Buscar artigos</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar artigos, temas ou palavras-chave"
        className="h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/25"
        aria-label="Buscar artigos"
      />
    </label>
  );
}
