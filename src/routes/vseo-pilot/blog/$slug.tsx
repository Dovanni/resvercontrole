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
      { title: `${loaderData.metaTitle} | VSEO Pilot` },
      { name: 'description', content: loaderData.metaDescription },
      { property: 'og:title', content: loaderData.metaTitle },
      { property: 'og:description', content: loaderData.metaDescription },
      { property: 'og:type', content: 'article' }
    ]
  })
});

function PilotArticleView() {
  const article = Route.useLoaderData();

  return (
    <article className="max-w-3xl mx-auto py-4 sm:py-8">
      <div className="mb-8 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-primary transition-colors">
          <Link to="/vseo-pilot/blog">
            <ChevronLeft className="w-4 h-4 mr-1" /> Todos os artigos
          </Link>
        </Button>
        <div className="flex gap-2">
           <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
              <Share2 className="w-3.5 h-3.5" />
           </Button>
        </div>
      </div>

      <header className="space-y-6 mb-12">
        <div className="space-y-3">
          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase tracking-wider text-[10px]">
            {article.category}
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
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

      <div 
        className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary hover:prose-a:underline prose-img:rounded-xl"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

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
            Este artigo é uma demonstração dos recursos VSEO Pilot do VEJAMAIS. Conheça as ferramentas que auxiliam na gestão da sua empresa.
          </p>
          <Button className="rounded-full px-8">
            Conheça o VEJAMAIS
          </Button>
        </div>
      </footer>
      
      {/* JSON-LD Script Block (Visible in Inspector for Validation) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": article.title,
            "description": article.metaDescription,
            "author": {
              "@type": "Person",
              "name": article.author
            },
            "publisher": {
              "@type": "Organization",
              "name": "VEJAMAIS"
            },
            "datePublished": article.publishedAt,
            "dateModified": article.updatedAt,
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://vejamais.com.br/vseo-pilot/blog/${article.slug}`
            },
            "inLanguage": "pt-BR"
          })
        }}
      />
    </article>
  );
}
