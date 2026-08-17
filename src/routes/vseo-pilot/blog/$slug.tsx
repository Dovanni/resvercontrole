import { createFileRoute, notFound } from '@tanstack/react-router';
import { MOCK_ARTICLES } from '@/features/vseo-pilot/mockArticles';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, ChevronLeft, Share2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/vseo-pilot/blog/$slug')({
  loader: ({ params }) => {
    const article = MOCK_ARTICLES.find(a => a.slug === params.slug);
    if (!article) throw notFound();
    return article;
  },
  component: PilotArticleView,
  head: ({ loaderData }) => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
      { title: `${loaderData?.metaTitle || 'Artigo'} | VSEO Pilot` },
      { name: 'description', content: loaderData?.metaDescription || '' },
      { property: 'og:title', content: loaderData?.metaTitle || '' },
      { property: 'og:description', content: loaderData?.metaDescription || '' },
      { property: 'og:type', content: 'article' }
    ]
  })
});

function PilotArticleView() {
  const article = Route.useLoaderData();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      {/* Breadcrumb Visual Real */}
      <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8 overflow-x-auto whitespace-nowrap pb-2">
        <ol className="flex items-center gap-2 text-xs text-muted-foreground">
          <li>
            <Link to="/vseo-pilot" className="hover:text-primary transition-colors flex items-center gap-1.5">
              VSEO Pilot
            </Link>
          </li>
          <li className="flex items-center gap-2">
            <span className="opacity-40">/</span>
            <Link to="/vseo-pilot/blog" className="hover:text-primary transition-colors">
              Blog Piloto
            </Link>
          </li>
          <li className="flex items-center gap-2 text-slate-900 font-medium" aria-current="page">
            <span className="opacity-40">/</span>
            <span className="truncate max-w-[200px] sm:max-w-md">
              {article.title}
            </span>
          </li>
        </ol>
      </nav>

      <article className="max-w-[800px] mx-auto py-4 sm:py-8">
        <header className="space-y-6 mb-12">
          <div className="space-y-3">
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase tracking-wider text-[10px]">
              {article.category}
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              {article.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground border-y py-6 border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                V
              </div>
              <div>
                <p className="font-semibold text-slate-900 leading-none">{article.author}</p>
                <p className="text-[11px] mt-1">Editoria Piloto</p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-100 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 opacity-70" />
              <span>17 de Agosto, 2026</span>
            </div>
          </div>
        </header>

        <div className="editorial-content">
           <div 
            className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-p:leading-[1.75] prose-p:mb-8 prose-a:text-primary hover:prose-a:underline prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>

        <footer className="mt-16 pt-8 border-t border-slate-100 space-y-8">
          <div className="flex flex-wrap gap-2">
            {article.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="bg-primary/5 rounded-2xl p-8 border border-primary/10 text-center space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Gostou deste conteúdo?</h3>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Este artigo é uma demonstração dos recursos VSEO Pilot do VEJAMAIS ERP. Conheça as ferramentas que auxiliam na gestão da sua empresa.
            </p>
            <Button className="rounded-full px-8">
              Conheça o VEJAMAIS ERP
            </Button>
          </div>

          <div className="text-center pt-8">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-primary transition-colors">
              <Link to="/vseo-pilot/blog">
                <ChevronLeft className="w-4 h-4 mr-1" /> Todos os artigos
              </Link>
            </Button>
          </div>
        </footer>
        
        {/* SEO & Rich Snippets Visualization Section */}
        <section className="mt-16 p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Inspeção Técnica VSEO</h4>
          
          <div className="grid gap-4 text-xs">
            <div className="p-3 bg-white rounded border border-slate-200">
              <span className="font-bold block mb-1">Rich Snippet: BreadcrumbList</span>
              <code className="text-[10px] text-slate-600">
                VSEO Pilot &gt; Blog Piloto &gt; {article.title}
              </code>
            </div>
            
            <div className="p-3 bg-white rounded border border-slate-200">
              <span className="font-bold block mb-1">Rich Snippet: BlogPosting</span>
              <div className="text-[10px] text-slate-500 space-y-1">
                <p>Type: BlogPosting</p>
                <p>Publisher: VEJAMAIS ERP</p>
                <p>Headline: {article.title}</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* JSON-LD Script Block (Safe Implementation) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "headline": article.title,
                "description": article.metaDescription,
                "image": "https://vejamais.com.br/placeholder-blog.jpg",
                "author": {
                  "@type": "Person",
                  "name": article.author
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "VEJAMAIS ERP",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://vejamais.com.br/logo.png"
                  }
                },
                "datePublished": article.publishedAt,
                "dateModified": article.updatedAt,
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `https://vejamais.com.br/vseo-pilot/blog/${article.slug}`
                },
                "inLanguage": "pt-BR"
              },
              {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "VSEO Pilot",
                    "item": "https://vejamais.com.br/vseo-pilot"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Blog Piloto",
                    "item": "https://vejamais.com.br/vseo-pilot/blog"
                  },
                  {
                    "@type": "ListItem",
                    "position": 3,
                    "name": article.title,
                    "item": `https://vejamais.com.br/vseo-pilot/blog/${article.slug}`
                  }
                ]
              }
            ])
          }}
        />
      </article>
    </div>
  );
}
