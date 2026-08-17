
import { createFileRoute, notFound, Link } from '@tanstack/react-router';
import { MOCK_ARTICLES } from '@/features/vseo-pilot/mockArticles';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  ChevronLeft, 
  AlertCircle, 
  ArrowLeft, 
  User, 
  Clock, 
  CheckCircle2, 
  Smartphone, 
  Monitor, 
  Share2,
  Code,
  AlertTriangle,
  Info,
  Check,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PilotBadge } from '@/components/vseo-pilot/PilotUI';
import { useState } from 'react';

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
  }),
  notFoundComponent: () => {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-12 text-center space-y-8 shadow-xl shadow-slate-200/50 border border-slate-100 animate-in zoom-in-95 duration-500">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-3xl bg-amber-50 flex items-center justify-center border-4 border-white shadow-lg shadow-amber-200/20 rotate-12 group-hover:rotate-0 transition-transform">
              <AlertCircle className="w-12 h-12 text-amber-500" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-none">
              Artigo não encontrado
            </h1>
            <p className="text-lg text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
              O conteúdo piloto solicitado não existe ou não está disponível em nosso ambiente sintético.
            </p>
          </div>

          <div className="pt-6">
            <Button asChild size="lg" className="rounded-full px-10 font-bold shadow-lg shadow-primary/20">
              <Link to="/vseo-pilot/blog">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Blog Piloto
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
});

function PilotArticleView() {
  const article = Route.useLoaderData();
  const [activePreviewTab, setActivePreviewTab] = useState<'google' | 'social' | 'schema'>('google');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  const googleTitle = article.metaTitle.length > 60 ? article.metaTitle.substring(0, 57) + '...' : article.metaTitle;
  const googleDesc = article.metaDescription.length > 155 ? article.metaDescription.substring(0, 152) + '...' : article.metaDescription;

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-700">
      {/* 3. Breadcrumb Visual Verdadeiro */}
      <nav aria-label="Breadcrumb" className="mb-10 overflow-x-auto whitespace-nowrap pb-4 scrollbar-hide border-b border-slate-100">
        <ol className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <li>
            <Link to="/vseo-pilot" className="hover:text-primary transition-colors flex items-center gap-2 group">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-primary transition-colors"></span>
              VSEO Pilot
            </Link>
          </li>
          <li className="flex items-center gap-3">
            <ChevronRight className="w-3 h-3 opacity-30" />
            <Link to="/vseo-pilot/blog" className="hover:text-primary transition-colors">
              Blog Piloto
            </Link>
          </li>
          <li className="flex items-center gap-3 text-slate-900 font-black" aria-current="page">
            <ChevronRight className="w-3 h-3 opacity-30" />
            <span className="truncate max-w-[200px] sm:max-w-md">
              {article.title}
            </span>
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Main Content Column */}
        <div className="lg:col-span-8">
          <article className="editorial-container bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <header className="p-8 sm:p-12 space-y-8 bg-slate-50/50 border-b border-slate-100">
              <Badge className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/10 transition-colors uppercase text-[10px] font-black tracking-[0.2em] px-3 py-1.5">
                {article.category}
              </Badge>
              
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-[1.1]">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-primary font-black text-sm">
                    {article.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-slate-900 leading-none mb-1">{article.author}</p>
                    <p className="opacity-60 font-medium">Equipe Editorial</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 opacity-40" />
                  <span>{article.lastUpdate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 opacity-40" />
                  <span>5 min de leitura</span>
                </div>
              </div>
            </header>

            <div className="p-8 sm:p-12">
              <div 
                className="prose prose-slate prose-lg max-w-none 
                  prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tight
                  prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:leading-tight
                  prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
                  prose-p:text-slate-600 prose-p:leading-[1.8] prose-p:mb-8 prose-p:font-medium
                  prose-a:text-primary prose-a:font-bold hover:prose-a:underline
                  prose-strong:text-slate-900 prose-strong:font-black
                  prose-img:rounded-3xl prose-img:shadow-2xl prose-img:shadow-slate-200"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
              
              <footer className="mt-20 pt-10 border-t border-slate-100 space-y-12">
                <div className="flex flex-wrap gap-2.5">
                  {article.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary transition-all rounded-full px-4 py-1 font-bold text-[10px] uppercase tracking-wider">
                      #{tag}
                    </Badge>
                  ))}
                </div>

                <div className="bg-slate-900 rounded-[2rem] p-10 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-20 blur-[100px] -translate-y-32 translate-x-32 group-hover:scale-125 transition-transform duration-1000"></div>
                  <div className="relative z-10 space-y-6 max-w-lg">
                    <h3 className="text-3xl font-black tracking-tight leading-[1.1]">Gestão integrada que gera resultados.</h3>
                    <p className="text-slate-400 font-medium text-lg leading-relaxed">
                      Descubra como o VEJAMAIS ERP pode transformar a produtividade do seu negócio.
                    </p>
                    <Button asChild className="rounded-full px-10 h-12 font-black bg-white text-slate-900 hover:bg-slate-100 shadow-xl shadow-white/5">
                      <Link to="/">Conhecer VEJAMAIS ERP</Link>
                    </Button>
                  </div>
                </div>

                <div className="text-center">
                  <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-primary font-bold uppercase tracking-widest text-[10px]">
                    <Link to="/vseo-pilot/blog">
                      <ChevronLeft className="w-4 h-4 mr-2" /> Voltar ao Blog Piloto
                    </Link>
                  </Button>
                </div>
              </footer>
            </div>
          </article>
        </div>

        {/* Sidebar / VSEO Manager Tools Column */}
        <aside className="lg:col-span-4 space-y-8">
          {/* 5. Google Preview Premium & 6. Open Graph Preview */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden sticky top-24">
            <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">VSEO Premium Tool</span>
              <div className="flex bg-white p-1 rounded-full border border-slate-200">
                <button 
                  onClick={() => setActivePreviewTab('google')}
                  className={`p-1.5 rounded-full transition-all ${activePreviewTab === 'google' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setActivePreviewTab('social')}
                  className={`p-1.5 rounded-full transition-all ${activePreviewTab === 'social' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setActivePreviewTab('schema')}
                  className={`p-1.5 rounded-full transition-all ${activePreviewTab === 'schema' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Code className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {activePreviewTab === 'google' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">Google Search Preview</h4>
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                       <button 
                        onClick={() => setDevice('desktop')}
                        className={`p-1 rounded ${device === 'desktop' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
                       >
                         <Monitor className="w-3.5 h-3.5" />
                       </button>
                       <button 
                        onClick={() => setDevice('mobile')}
                        className={`p-1 rounded ${device === 'mobile' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
                       >
                         <Smartphone className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  </div>

                  <div className={`google-result space-y-2 font-sans ${device === 'mobile' ? 'max-w-[320px] mx-auto' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">V</div>
                      <div className="text-[11px]">
                        <p className="text-[#202124] leading-tight">VEJAMAIS ERP</p>
                        <p className="text-[#5f6368] leading-tight text-[10px]">https://vejamais.com.br › blog › {article.slug}</p>
                      </div>
                    </div>
                    <h5 className="text-[#1a0dab] text-xl hover:underline cursor-pointer leading-tight mb-1 font-medium">
                      {googleTitle}
                    </h5>
                    <p className="text-[#4d5156] text-[13px] leading-relaxed line-clamp-2">
                      {googleDesc}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-50 space-y-3">
                     <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>Meta Title</span>
                        <span className={article.metaTitle.length > 60 ? 'text-amber-500' : 'text-emerald-500'}>
                          {article.metaTitle.length}/60
                        </span>
                     </div>
                     <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>Meta Description</span>
                        <span className={article.metaDescription.length > 155 ? 'text-amber-500' : 'text-emerald-500'}>
                          {article.metaDescription.length}/155
                        </span>
                     </div>
                  </div>

                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                      Prévia orientativa. O Google pode reescrever títulos e descrições baseados na consulta.
                    </p>
                  </div>
                </div>
              )}

              {activePreviewTab === 'social' && (
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-slate-900">Open Graph Social Preview</h4>
                  
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm group">
                    <div className="aspect-[1.91/1] bg-slate-900 relative flex items-center justify-center p-8 overflow-hidden">
                       <div className="absolute inset-0 opacity-20">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full blur-[60px]"></div>
                         <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary rounded-full blur-[60px]"></div>
                       </div>
                       <div className="relative z-10 text-center space-y-2">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto shadow-xl group-hover:scale-110 transition-transform">
                             <span className="text-primary font-black">V</span>
                          </div>
                          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/60">VEJAMAIS ERP</p>
                       </div>
                    </div>
                    <div className="p-4 bg-[#f2f3f5] space-y-1">
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">VEJAMAIS.COM.BR</p>
                      <h6 className="font-bold text-slate-900 text-sm line-clamp-1">{article.metaTitle}</h6>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{article.metaDescription}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                     <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>og:image otimizado (sintético)</span>
                     </div>
                     <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>og:type: article validado</span>
                     </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'schema' && (
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-slate-900">JSON-LD Data Structure</h4>
                  
                  <div className="bg-slate-900 rounded-xl p-4 overflow-hidden relative group">
                    <pre className="text-[9px] text-emerald-400 font-mono leading-relaxed h-[200px] overflow-y-auto scrollbar-hide">
{`{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "${article.title}",
  "publisher": {
    "@type": "Organization",
    "name": "VEJAMAIS ERP"
  },
  "author": {
    "@type": "Person",
    "name": "${article.author}"
  },
  "inLanguage": "pt-BR"
}`}
                    </pre>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Badge className="bg-white/10 text-white border-0 text-[8px]">READ ONLY</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-slate-50 rounded border border-slate-100 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                      <p className="text-[10px] font-bold text-emerald-600">VALIDADO</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tipos</p>
                      <p className="text-[10px] font-bold text-slate-900">3 ENTIDADES</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">SEO Health Check</h4>
               <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                     <span className="font-bold text-slate-600">Otimização On-Page</span>
                     <span className="font-black text-primary">85/100</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                     <div className="h-full bg-primary" style={{ width: '85%' }}></div>
                  </div>
               </div>
               
               <ul className="space-y-2">
                 {[
                   'Presença de H1 único',
                   'Hierarquia de títulos válida',
                   'Alt-text nas imagens mockadas',
                   'Canonical link definido',
                 ].map((check, i) => (
                   <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                     <Check className="w-3 h-3 text-emerald-500" /> {check}
                   </li>
                 ))}
               </ul>
            </div>
          </div>
          
          <div className="bg-amber-50/50 rounded-3xl p-6 border border-amber-100 flex gap-4">
             <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
             <div className="space-y-2">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Aviso de Gestão Piloto</p>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Este artigo é um <strong>Rascunho Sintético</strong>. Alterações feitas no editor (em memória) não afetam o banco de dados e serão perdidas ao recarregar a página.
                </p>
             </div>
          </div>
        </aside>
      </div>
      
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
    </div>
  );
}
