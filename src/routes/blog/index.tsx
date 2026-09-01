import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BLOG_ARTICLES } from "@/features/blog/articles";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog Editorial VEJAMAIS ERP — Preview V2" },
      {
        name: "description",
        content:
          "Preview editorial do VEJAMAIS ERP sobre gestão, finanças, operações e crescimento empresarial.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:title", content: "Blog Editorial VEJAMAIS ERP — Preview V2" },
      {
        property: "og:description",
        content:
          "Conteúdo editorial em preparação sobre gestão, finanças, operações e crescimento empresarial.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://vejamais.com.br/blog" }],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(BLOG_ARTICLES.map((article) => article.category)))],
    [],
  );

  const articles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return BLOG_ARTICLES.filter((article) => {
      const matchesCategory = category === "Todas" || article.category === category;
      const matchesSearch =
        !normalizedSearch ||
        article.title.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        article.excerpt.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        article.tags.some((tag) => tag.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
        BLOG EDITORIAL V2 — PREVIEW ISOLADO — NÃO PUBLICADO
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">VEJAMAIS ERP Editorial</p>
        <h1 className="mx-auto mt-4 max-w-4xl font-display text-4xl font-bold tracking-tight md:text-6xl">
          Gestão mais clara para decisões melhores
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          Conteúdo prático sobre finanças, operações, estoque, e-commerce e gestão empresarial.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar artigos, temas ou palavras-chave"
            className="h-11 rounded-lg border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Buscar artigos"
          />
          <div className="flex flex-wrap gap-2" aria-label="Filtrar por categoria">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  category === item ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <article key={article.id} className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{article.category}</span>
                <span>{article.readingTimeMinutes} min</span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold leading-tight">{article.title}</h2>
              <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">{article.excerpt}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {article.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                to="/blog/$slug"
                params={{ slug: article.slug }}
                className="mt-6 inline-flex font-semibold text-primary hover:underline"
              >
                Ler artigo
              </Link>
            </article>
          ))}
        </div>

        {articles.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            Nenhum artigo encontrado com os filtros atuais.
          </div>
        )}
      </section>
    </main>
  );
}
