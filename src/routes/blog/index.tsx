import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, Compass, Layers3 } from "lucide-react";
import { BlogShell, EditorialArticleCard, SearchField } from "@/components/blog/editorial-ui";
import { listPublishedBlogArticles } from "@/features/blog/blog.repository";
import { buildBlogIndexHead } from "@/features/blog/blog-seo";

export const Route = createFileRoute("/blog/")({
  loader: () => listPublishedBlogArticles(),
  head: () => buildBlogIndexHead(),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const articles = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(articles.map((article) => article.category)))], [articles]);
  const filteredArticles = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return articles.filter((article) => (category === "Todas" || article.category === category) && (!q || article.title.toLocaleLowerCase("pt-BR").includes(q) || article.excerpt.toLocaleLowerCase("pt-BR").includes(q) || article.tags.some((tag) => tag.toLocaleLowerCase("pt-BR").includes(q))));
  }, [articles, category, search]);
  const featuredArticle = category === "Todas" && !search.trim() ? filteredArticles[0] : undefined;
  const secondaryArticles = featuredArticle ? filteredArticles.slice(1) : filteredArticles;

  return <BlogShell><main>
    <section className="relative overflow-hidden border-b"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.72fr] lg:items-end lg:py-24">
      <div><span className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm"><BookOpen className="size-3.5" /> VEJAMAIS ERP Editorial</span><h1 className="mt-5 max-w-4xl font-display text-4xl font-bold tracking-tight text-petrol sm:text-5xl md:text-6xl">Gestão mais clara para decisões melhores</h1><p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Guias práticos sobre finanças, estoque, processos e gestão empresarial.</p></div>
      <div className="grid gap-3"><EditorialPrinciple icon={<Compass className="size-5" />} title="Aplicável" text="Conteúdo pensado para a rotina real de gestão." /><EditorialPrinciple icon={<Layers3 className="size-5" />} title="Organizado" text="Temas conectados em jornadas de aprendizagem." /><EditorialPrinciple icon={<BookOpen className="size-5" />} title="Editorial" text="Explicar primeiro. Produto só quando fizer sentido." /></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <div className="grid gap-4 rounded-3xl border bg-card/60 p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><SearchField value={search} onChange={setSearch} /><div className="flex flex-wrap gap-2" aria-label="Filtrar por categoria">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`rounded-full border px-4 py-2 text-sm font-medium ${category === item ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{item}</button>)}</div></div>
      {featuredArticle && <div className="mt-10"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Destaque editorial</p><EditorialArticleCard article={featuredArticle} featured /></div>}
      <div className="mt-12"><h2 className="mb-5 font-display text-2xl font-semibold">{filteredArticles.length === 1 ? "1 artigo publicado" : `${filteredArticles.length} artigos publicados`}</h2>{secondaryArticles.length > 0 && <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{secondaryArticles.map((article) => <EditorialArticleCard key={article.id} article={article} />)}</div>}{filteredArticles.length === 0 && <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center"><BookOpen className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 font-display text-2xl font-semibold">Nenhum artigo publicado ainda</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Os conteúdos aparecem aqui somente depois de concluírem o workflow editorial e serem efetivamente publicados.</p></div>}</div>
    </section>
  </main></BlogShell>;
}

function EditorialPrinciple({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border bg-background/75 p-4 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-xl bg-mint p-2 text-primary-deep">{icon}</div><div><p className="font-semibold text-foreground">{title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p></div></div></div>;
}
