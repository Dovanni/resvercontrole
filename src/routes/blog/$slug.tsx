import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getBlogArticleBySlug } from "@/features/blog/articles";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const article = getBlogArticleBySlug(params.slug);
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
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Blog VEJAMAIS ERP</p>
        <h1 className="mt-4 font-display text-4xl font-bold">Artigo não encontrado</h1>
        <p className="mt-4 text-muted-foreground">O conteúdo solicitado não existe neste preview editorial.</p>
        <Link to="/blog" className="mt-7 inline-flex font-semibold text-primary hover:underline">
          Voltar ao Blog
        </Link>
      </div>
    </main>
  ),
});

function BlogArticlePage() {
  const article = Route.useLoaderData();
  const publishedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(
    new Date(article.publishedAt),
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
        BLOG EDITORIAL V2 — PREVIEW ISOLADO — NÃO PUBLICADO
      </div>

      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link to="/" className="hover:text-primary">Início</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link to="/blog" className="hover:text-primary">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">{article.title}</li>
          </ol>
        </nav>

        <header className="mt-10 border-b pb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{article.category}</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-5xl">{article.title}</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{article.excerpt}</p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>{article.author}</span>
            <span>{publishedDate}</span>
            <span>{article.readingTimeMinutes} min de leitura</span>
          </div>
        </header>

        <div className="space-y-10 py-10">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-2xl font-semibold md:text-3xl">{section.heading}</h2>
              <div className="mt-4 space-y-5 text-base leading-8 text-muted-foreground md:text-lg">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-t pt-8">
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border bg-card p-7">
            <h2 className="font-display text-2xl font-semibold">Conheça o VEJAMAIS ERP</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Centralize sua gestão comercial e financeira em uma plataforma preparada para acompanhar a operação do negócio.
            </p>
            <Link to="/" className="mt-5 inline-flex font-semibold text-primary hover:underline">
              Conhecer a plataforma
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
