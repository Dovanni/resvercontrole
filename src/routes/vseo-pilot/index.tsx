
import { createFileRoute, Link } from '@tanstack/react-router';
import { MOCK_ARTICLES } from '@/features/vseo-pilot/mockArticles';
import { PilotDisclaimer } from '@/components/vseo-pilot/PilotUI';
import { 
  FileText, 
  Eye, 
  Edit3, 
  ShieldCheck, 
  AlertCircle, 
  Plus, 
  Search, 
  Filter, 
  ArrowUpDown,
  FileEdit,
  LayoutGrid,
  Settings2,
  ListChecks,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';

export const Route = createFileRoute('/vseo-pilot/')({
  component: PilotDashboard,
});

function PilotDashboard() {
  const [search, setSearch] = useState('');
  
  const stats = useMemo(() => {
    const total = MOCK_ARTICLES.length;
    const avgScore = Math.round(MOCK_ARTICLES.reduce((acc, a) => acc + a.seoScore, 0) / total);
    const drafts = MOCK_ARTICLES.filter(a => a.status === 'draft').length;
    const categories = new Set(MOCK_ARTICLES.map(a => a.category)).size;
    
    return [
      { label: 'Conteúdos', value: total, icon: FileText },
      { label: 'Saúde SEO média', value: `${avgScore}/100`, icon: ShieldCheck },
      { label: 'Rascunhos', value: drafts, icon: FileEdit },
      { label: 'Categorias', value: categories, icon: LayoutGrid },
    ];
  }, []);

  const filteredArticles = useMemo(() => {
    return MOCK_ARTICLES.filter(a => 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 3.1 Cabeçalho Administrativo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b pb-8 border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              VSEO Manager
            </h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[10px] font-bold py-0.5 px-2">
              VEJAMAIS ERP
            </Badge>
          </div>
          <p className="text-slate-500 font-medium">
            SEO orgânico, conteúdo editorial e dados estruturados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold py-1 px-3">
            Ambiente isolado
          </Badge>
          <Button className="rounded-full shadow-lg shadow-primary/20 font-bold px-6">
            <Plus className="w-4 h-4 mr-2" /> Novo artigo — Piloto
          </Button>
        </div>
      </div>

      {/* 3.2 Indicadores Editoriais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 shadow-sm overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                <stat.icon className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-black text-slate-900 leading-tight">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3.3 Barra de ferramentas */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Buscar por título..." 
            className="pl-9 rounded-lg border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" className="text-xs h-9 font-semibold">
            <Filter className="w-3.5 h-3.5 mr-2 opacity-60" /> Categoria
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-9 font-semibold">
            <Settings2 className="w-3.5 h-3.5 mr-2 opacity-60" /> Status
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-9 font-semibold">
            <ArrowUpDown className="w-3.5 h-3.5 mr-2 opacity-60" /> Saúde SEO
          </Button>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="text-xs h-9 text-slate-500">
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* 3.4 Gestão de artigos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map((article) => (
          <Card key={article.id} className="flex flex-col border-slate-200 hover:border-primary/40 transition-all shadow-sm hover:shadow-md group overflow-hidden bg-white">
            <div className="h-2 bg-slate-100 w-full group-hover:bg-primary/20 transition-colors">
               <div 
                className="h-full bg-primary transition-all duration-1000" 
                style={{ width: `${article.seoScore}%` }}
              />
            </div>
            <CardHeader className="pb-3 pt-5">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline" className="bg-slate-50 text-[10px] uppercase tracking-widest font-bold text-slate-500 border-slate-200">
                  {article.category}
                </Badge>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-bold uppercase">
                  <FileEdit className="w-2.5 h-2.5" /> Rascunho Sintético
                </div>
              </div>
              <CardTitle className="text-lg leading-tight font-bold text-slate-800 group-hover:text-primary transition-colors">
                {article.title}
              </CardTitle>
              <CardDescription className="line-clamp-2 mt-2 text-slate-500 text-sm font-medium">
                {article.excerpt}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow pt-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Saúde VSEO
                  </span>
                  <span className="text-primary font-black">{article.seoScore}/100</span>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium italic leading-tight">Palavra-chave foco interna — não enviada ao Google</span>
                </div>

                <div className="pt-2 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                   <span>ATUALIZADO EM</span>
                   <span>{article.lastUpdate}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 pt-4 pb-5 px-5 bg-slate-50/50 border-t border-slate-100">
              <Button asChild variant="outline" size="sm" className="w-full text-xs font-bold rounded-lg h-9">
                <Link to="/vseo-pilot/blog/$slug" params={{ slug: article.slug }}>
                  <Eye className="w-3.5 h-3.5 mr-2 opacity-70" /> Visualizar
                </Link>
              </Button>
              <Button disabled variant="secondary" size="sm" className="w-full text-xs font-bold rounded-lg h-9 opacity-80 cursor-not-allowed border-slate-200">
                <Edit3 className="w-3.5 h-3.5 mr-2 opacity-70" /> Editar — Piloto
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* 3.5 Painel complementar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-600">
              <ListChecks className="w-4 h-4 text-primary" /> Checklist de Boas Práticas SEO
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="space-y-3">
              {[
                { label: 'Meta title otimizado para palavra-chave', status: 'ok' },
                { label: 'Meta description com CTA claro', status: 'ok' },
                { label: 'Estrutura semântica (H1, H2, H3)', status: 'ok' },
                { label: 'JSON-LD BlogPosting implementado', status: 'ok' },
                { label: 'Slug amigável e legível', status: 'ok' },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-xs font-medium text-slate-600">
                   <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                   </div>
                   {item.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-600">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas e Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-3 bg-amber-50 p-3 rounded-lg border border-amber-100">
               <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
               <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                 <strong>Aviso de Snippet:</strong> O Google pode reescrever seu título e descrição se considerar que o conteúdo gerado automaticamente é irrelevante para a busca do usuário.
               </p>
            </div>
            <div className="space-y-2 text-[11px] text-slate-500 font-medium pl-1">
              <p className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>Mantenha o Meta Title entre 50-60 caracteres.</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>Meta Description ideal entre 120-155 caracteres.</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <PilotDisclaimer />
    </div>
  );
}
