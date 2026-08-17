
import { createFileRoute, Link } from '@tanstack/react-router';
import { MOCK_ARTICLES } from '@/features/vseo-pilot/mockArticles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, User, FileText, Search, Filter, ShieldCheck } from 'lucide-react';
import { useState, useMemo } from 'react';

export const Route = createFileRoute('/vseo-pilot/blog/')({
  component: PilotBlogIndex,
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
      { title: 'Blog VEJAMAIS ERP | Piloto Editorial' }
    ]
  })
});

function PilotBlogIndex() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    return Array.from(new Set(MOCK_ARTICLES.map(a => a.category)));
  }, []);

  const filteredArticles = useMemo(() => {
    return MOCK_ARTICLES.filter(a => {
      const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                           a.excerpt.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory ? a.category === activeCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 7.1 Hero editorial */}
      <section className="text-center py-8 space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest mb-2">
           <ShieldCheck className="w-3.5 h-3.5" /> Conteúdo Piloto
        </div>
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[0.9]">
            Blog VEJAMAIS ERP
          </h1>
          <p className="text-xl text-slate-500 font-medium leading-relaxed">
            Conteúdo educativo sobre gestão, tecnologia e crescimento empresarial.
          </p>
        </div>
        <div className="pt-2">
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed border-t border-slate-100 pt-6 italic">
            Esta é uma vitrine editorial demonstrativa para validação de fluxos VSEO. Nenhuma das informações abaixo constitui conselho financeiro ou jurídico real.
          </p>
        </div>
      </section>

      {/* 7.2 Navegação editorial */}
      <div className="sticky top-20 z-40 bg-slate-50/95 backdrop-blur-sm py-4 border-y border-slate-200/60 space-y-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4 px-2">
          <div className="relative w-full md:flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar no blog..." 
              className="pl-10 rounded-full border-slate-200 bg-white focus-visible:ring-primary shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full md:w-auto scrollbar-hide">
             <Button 
              variant={activeCategory === null ? "default" : "outline"} 
              size="sm" 
              onClick={() => setActiveCategory(null)}
              className="rounded-full text-xs font-bold px-5 h-9"
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"} 
                size="sm" 
                onClick={() => setActiveCategory(cat)}
                className="rounded-full text-xs font-bold px-5 h-9 whitespace-nowrap bg-white"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-2">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             {filteredArticles.length} resultados encontrados
           </p>
        </div>
      </div>

      <div className="grid gap-10 max-w-4xl mx-auto">
        {filteredArticles.map((article) => (
          <Link 
            key={article.id} 
            to="/vseo-pilot/blog/$slug" 
            params={{ slug: article.slug }}
            className="group block"
          >
            <Card className="overflow-hidden border-slate-200 group-hover:border-primary/40 transition-all group-hover:shadow-2xl group-hover:-translate-y-1 duration-300 bg-white border-0 shadow-sm ring-1 ring-slate-200">
              <div className="md:flex">
                <div className="md:w-[35%] bg-slate-50 flex items-center justify-center min-h-[240px] border-r border-slate-100 p-8 relative overflow-hidden">
                   <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                      <div className="absolute top-0 left-0 w-32 h-32 bg-primary rounded-full -translate-x-16 -translate-y-16 blur-3xl"></div>
                      <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary rounded-full translate-x-16 translate-y-16 blur-3xl"></div>
                   </div>
                   <div className="text-center space-y-3 relative z-10">
                      <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
                        <FileText className="w-8 h-8 text-primary" />
                      </div>
                      <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] leading-tight px-4 opacity-70">
                        {article.imageAlt}
                      </div>
                   </div>
                </div>
                <div className="md:w-[65%] p-8 space-y-6 flex flex-col justify-center">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/10 transition-colors uppercase text-[9px] font-black tracking-widest px-2.5 py-1">
                      {article.category}
                    </Badge>
                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {article.seoScore} Saúde SEO
                    </span>
                  </div>
                  <CardHeader className="p-0 space-y-3">
                    <CardTitle className="text-3xl font-extrabold group-hover:text-primary transition-colors leading-[1.1] text-slate-900 tracking-tight">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="text-base text-slate-500 line-clamp-2 leading-relaxed font-medium">
                      {article.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex items-center gap-6 text-[11px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-50 pt-6">
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 opacity-60" /> {article.author}
                    </span>
                    <span className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 opacity-60" /> {article.lastUpdate}
                    </span>
                  </CardContent>
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {filteredArticles.length === 0 && (
          <div className="text-center py-20 space-y-4">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Search className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-bold text-slate-900">Nenhum artigo encontrado</h3>
             <p className="text-slate-500 max-w-xs mx-auto">Tente ajustar seus termos de busca ou filtros de categoria.</p>
             <Button variant="outline" onClick={() => { setSearch(''); setActiveCategory(null); }} className="rounded-full">
               Limpar todos os filtros
             </Button>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto pt-12">
        <div className="bg-slate-900 rounded-3xl p-10 text-center text-white space-y-6 overflow-hidden relative">
           <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-20 blur-[100px] -translate-y-32 translate-x-32"></div>
           <div className="relative z-10 space-y-4">
              <h2 className="text-3xl font-black tracking-tight leading-none">Otimize a gestão do seu conteúdo</h2>
              <p className="text-slate-400 max-w-md mx-auto font-medium">
                Conheça como o VEJAMAIS ERP centraliza operações e ajuda sua empresa a crescer de forma organizada.
              </p>
              <div className="pt-4">
                 <Button className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-10 font-black h-12 shadow-xl shadow-white/5">
                   Falar com Especialista
                 </Button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
