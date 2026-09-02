import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import {
  BlogShell,
  EditorialArticleCard,
  EditorialVisual,
} from "@/components/blog/editorial-ui";
import {
  getPreviewBlogArticleBySlug,
  getRelatedPreviewBlogArticles,
} from "@/features/blog/blog.repository";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const article = getPreviewBlogArticleBySlug(params.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => {
    const article = loaderData;
    const canonical = article ? `https://vejamais.com.br/blog/${article.slug}` : "https://vejamais.com.br/blog";

    return {
      meta: [
        { title: article?.metaTitle ?? "Artigo | VEJAMAIS ERP" },
        { name: "description", content: article?.metaDescription ?? "Conteúdo editorial VEJAMAIS ERP." },
        { name: "robots", content: "noindex, nofollow, noarchive" },
        { property: "og:title", content: article?.metaTitle ?? "Artigo | VEJAMAIS ERP" },
        { property: "og:description", content: article?.metaDescription ?? "Conteúdo editorial VEJAMAIS ERP." },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: article?.metaTitle ?? "Artigo | VEJAMAIS ERP" },
        { name: "twitter:description", content: article?.metaDescription ?? "Conteúdo editorial VEJAMAIS ERP." },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: article
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: article.title,
                description: article.metaDescription,
                datePublished: article.publishedAt,
                dateModified: article.updatedAt,
                author: { "@type": "Organization", name: article.author },
                publisher: { "@type": "Organization", name: "VEJAMAIS ERP" },
                mainEntityOfPage: canonical,
                keywords: [article.focusKeyword, ...article.tags].join(", "),
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: "https://vejamais.com.br/" },
                  { "@type": "ListItem", position: 2, name: "Blog", item: "https://vejamais.com.br/blog" },
                  { "@type": "ListItem", position: 3, name: article.title, item: canonical },
                ],
              }),
            },
          ]
        : [],
    };
  },
  component: BlogArticlePage,
  notFoundComponent: BlogArticleNotFound,
});

function BlogArticlePage() {
  const article = Route.useLoaderData();
  const publishedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(article.publishedAt));

  const relatedArticles = getRelatedPreviewBlogArticles(article);

  return (
    <BlogShell>
      <main>
        <section className="border-b bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-2">
                <li><Link to="/" className="hover:text-primary">Início</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link to="/blog" className="hover:text-primary">Blog</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="max-w-[36ch] truncate text-foreground">{article.title}</li>
              </ol>
            </nav>
          </div>
        </section>

        <article>
          <header className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{article.category}</p>
              <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-tight tracking-tight text-petrol sm:text-5xl lg:text-6xl">
                {article.title}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">{article.excerpt}</p>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{article.author}</span>
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> {publishedDate}</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" /> {article.readingTimeMinutes} min de leitura</span>
              </div>
            </div>
            <EditorialVisual article={article} />
          </header>

          <div className="border-y bg-card/35">
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
              <div className="mx-auto w-full max-w-3xl space-y-12 lg:mx-0">
                {article.sections.map((section, index) => (
                  <section key={section.heading} id={`secao-${index + 1}`} className="scroll-mt-28">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{String(index + 1).padStart(2, "0")}</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-foreground md:text-3xl">{section.heading}</h2>
                    <div className="mt-5 space-y-5 text-base leading-8 text-muted-foreground md:text-lg">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <aside className="hidden rounded-2xl border bg-background p-5 lg:block lg:sticky lg:top-24" aria-label="Neste artigo">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Neste artigo</p>
                <ol className="mt-4 space-y-3 text-sm leading-5 text-muted-foreground">
                  {article.sections.map((section, index) => (
                    <li key={section.heading}>
                      <a href={`#secao-${index + 1}`} className="transition-colors hover:text-foreground">
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </div>

          <footer className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
            <div className="mx-auto max-w-3xl lg:mx-0">
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{tag}</span>
                ))}
              </div>

              <div className="mt-10 overflow-hidden rounded-3xl border bg-petrol text-white shadow-sm">
                <div className="p-7 sm:p-9">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">Gestão integrada</p>
                  <h2 className="mt-3 max-w-xl font-display text-2xl font-semibold sm:text-3xl">Leve essa rotina para um contexto de gestão mais organizado</h2>
                  <p className="mt-4 max-w-2xl leading-7 text-white/75">
                    O VEJAMAIS ERP reúne rotinas comerciais e financeiras para ajudar sua empresa a acompanhar informações de gestão em um mesmo ambiente.
                  </p>
                  <Link to="/cadastro" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                    Conhecer o VEJAMAIS ERP <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>

            {relatedArticles.length > 0 && (
              <section className="mt-16 border-t pt-12" aria-labelledby="related-title">
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Continue aprendendo</p>
                  <h2 id="related-title" className="mt-2 font-display text-2xl font-semibold md:text-3xl">Artigos relacionados</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {relatedArticles.map((related) => (
                    <EditorialArticleCard key={related.id} article={related} />
                  ))}
                </div>
              </section>
            )}
          </footer>
        </article>
      </main>
    </BlogShell>
  );
}

function BlogArticleNotFound() {
  return (
    <BlogShell>
      <main className="flex min-h-[70vh] items-center justify-center px-6 py-16 text-center">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Blog VEJAMAIS ERP</p>
          <h1 className="mt-4 font-display text-4xl font-bold text-petrol sm:text-5xl">Artigo não encontrado</h1>
          <p className="mt-4 leading-7 text-muted-foreground">O conteúdo solicitado não existe neste preview editorial ou o endereço foi alterado durante a fase de preparação.</p>
          <Link to="/blog" className="mt-7 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            Voltar ao Blog <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
    </BlogShell>
  );
}
