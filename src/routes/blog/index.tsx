import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, Compass, Layers3 } from "lucide-react";
import {
  BlogShell,
  EditorialArticleCard,
  SearchField,
} from "@/components/blog/editorial-ui";
import { BLOG_ARTICLES } from "@/features/blog/articles";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog Editorial VEJAMAIS ERP — Preview V2" },
      {
        name: "description",
        content:
          "Preview editorial do VEJAMAIS ERP sobre gestão financeira, estoque, operações, vendas e administração empresarial.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:title", content: "Blog Editorial VEJAMAIS ERP — Preview V2" },
      {
        property: "og:description",
        content:
          "Conteúdo editorial em preparação sobre gestão financeira, estoque, operações e crescimento empresarial.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://vejamais.com.br/blog" },
      { name: "twitter:card", content: "summary_large_image" },
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

  const filteredArticles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return BLOG_ARTICLES.filter((article) => {
      const matchesCategory = category === "Todas" || article.category === category;
      const matchesSearch =
        !normalizedSearch ||
        article.title.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        article.excerpt.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        article.category.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        article.tags.some((tag) => tag.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const featuredArticle = category === "Todas" && !search.trim() ? filteredArticles[0] : undefined;
  const secondaryArticles = featuredArticle ? filteredArticles.slice(1) : filteredArticles;

  return (
    <BlogShell>
      <main>
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(850px 420px at 12% 5%, rgba(34,197,94,0.15), transparent), radial-gradient(700px 360px at 94% 90%, rgba(124,58,237,0.08), transparent)",
            }}
          />
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.72fr] lg:items-end lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur">
                <BookOpen className="size-3.5" /> VEJAMAIS ERP Editorial
              </span>
              <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold tracking-tight text-petrol sm:text-5xl md:text-6xl lg:text-[4.25rem] lg:leading-[1.02]">
                Gestão mais clara para decisões melhores
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Guias práticos e explicações sobre finanças, estoque, processos, segurança e gestão empresarial — escritos para ajudar antes de vender.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <EditorialPrinciple icon={<Compass className="size-5" />} title="Aplicável" text="Conteúdo pensado para a rotina real de gestão." />
              <EditorialPrinciple icon={<Layers3 className="size-5" />} title="Organizado" text="Temas conectados em jornadas de aprendizagem." />
              <EditorialPrinciple icon={<BookOpen className="size-5" />} title="Editorial" text="Explicar primeiro. Produto só quando fizer sentido." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <div className="grid gap-4 rounded-3xl border bg-card/60 p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5">
            <SearchField value={search} onChange={setSearch} />
            <div className="flex flex-wrap gap-2" aria-label="Filtrar por categoria">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    category === item
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {featuredArticle && (
            <div className="mt-10">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Destaque editorial</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold md:text-3xl">Comece por aqui</h2>
                </div>
              </div>
              <EditorialArticleCard article={featuredArticle} featured />
            </div>
          )}

          <div className="mt-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {featuredArticle ? "Mais leituras" : "Resultados"}
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold md:text-3xl">
                  {filteredArticles.length === 1 ? "1 artigo encontrado" : `${filteredArticles.length} artigos encontrados`}
                </h2>
              </div>
              {(search || category !== "Todas") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("Todas");
                  }}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {secondaryArticles.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {secondaryArticles.map((article) => (
                  <EditorialArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}

            {filteredArticles.length === 0 && (
              <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center sm:p-14">
                <BookOpen className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-4 font-display text-2xl font-semibold">Nenhum artigo encontrado</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Tente outra palavra-chave ou volte para todas as categorias deste preview editorial.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </BlogShell>
  );
}

function EditorialPrinciple({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-background/75 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-mint p-2 text-primary-deep">{icon}</div>
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}
