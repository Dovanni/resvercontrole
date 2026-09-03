import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { BlogShell, EditorialArticleCard, EditorialVisual } from "@/components/blog/editorial-ui";
import { getPublishedBlogArticleBySlug, listPublishedBlogArticles } from "@/features/blog/blog.repository";
import { buildPublishedArticleHead } from "@/features/blog/blog-seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => { const article = await getPublishedBlogArticleBySlug(params.slug); if (!article) throw notFound(); return article; },
  head: ({ loaderData }) => loaderData ? buildPublishedArticleHead(loaderData) : ({ meta: [{ title: "Artigo | VEJAMAIS ERP" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: BlogArticlePage,
  notFoundComponent: BlogArticleNotFound,
});

function BlogArticlePage() {
  const article = Route.useLoaderData();
  const [relatedArticles, setRelatedArticles] = React.useState<typeof article[]>([]);
  React.useEffect(() => { listPublishedBlogArticles().then((items) => setRelatedArticles(items.filter((item) => item.slug !== article.slug).slice(0, 2))).catch(() => setRelatedArticles([])); }, [article.slug]);
  const publishedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(article.publishedAt));
  return <BlogShell><main><article>
    <header className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[1fr_0.82fr] lg:items-center"><div><nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground"><Link to="/">Início</Link> / <Link to="/blog">Blog</Link> / <span>{article.title}</span></nav><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{article.category}</p><h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-tight tracking-tight text-petrol sm:text-5xl lg:text-6xl">{article.title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">{article.excerpt}</p><div className="mt-7 flex flex-wrap gap-5 text-sm text-muted-foreground"><span className="font-medium text-foreground">{article.author}</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> {publishedDate}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" /> {article.readingTimeMinutes} min de leitura</span></div></div><EditorialVisual article={article} /></header>
    <div className="border-y bg-card/35"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="mx-auto w-full max-w-3xl space-y-12 lg:mx-0">{article.sections.map((section,index) => <section key={section.heading} id={`secao-${index+1}`}><h2 className="font-display text-2xl font-semibold md:text-3xl">{section.heading}</h2><div className="mt-5 space-y-5 text-base leading-8 text-muted-foreground md:text-lg">{section.paragraphs.map((p) => <p key={p}>{p}</p>)}</div></section>)}</div><aside className="hidden rounded-2xl border bg-background p-5 lg:block"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Neste artigo</p><ol className="mt-4 space-y-3 text-sm text-muted-foreground">{article.sections.map((s,i)=><li key={s.heading}><a href={`#secao-${i+1}`}>{s.heading}</a></li>)}</ol></aside></div></div>
    <footer className="mx-auto max-w-7xl px-4 py-12 md:px-6"><div className="flex flex-wrap gap-2">{article.tags.map((tag)=><span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{tag}</span>)}</div>{relatedArticles.length>0&&<section className="mt-16 border-t pt-12"><h2 className="mb-6 font-display text-2xl font-semibold">Artigos relacionados</h2><div className="grid gap-6 md:grid-cols-2">{relatedArticles.map((related)=><EditorialArticleCard key={related.id} article={related}/>)}</div></section>}</footer>
  </article></main></BlogShell>;
}

function BlogArticleNotFound() { return <BlogShell><main className="flex min-h-[70vh] items-center justify-center px-6 py-16 text-center"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Blog VEJAMAIS ERP</p><h1 className="mt-4 font-display text-4xl font-bold text-petrol">Artigo não encontrado</h1><p className="mt-4 leading-7 text-muted-foreground">O conteúdo solicitado não está publicado ou não existe.</p><Link to="/blog" className="mt-7 inline-flex items-center gap-1.5 font-semibold text-primary">Voltar ao Blog <ArrowRight className="size-4" /></Link></div></main></BlogShell>; }

import React from "react";
