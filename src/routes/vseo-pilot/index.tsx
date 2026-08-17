import { createFileRoute, Link } from '@tanstack/react-router';
import { MOCK_ARTICLES } from '@/features/vseo-pilot/mockArticles';
import { PilotDisclaimer } from '@/components/vseo-pilot/PilotUI';
import { FileText, Eye, Edit3, ShieldCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/vseo-pilot/')({
  component: PilotDashboard,
});

function PilotDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VSEO Pilot Lab</h1>
          <p className="text-muted-foreground mt-1">Gestão de Conteúdo Orgânico e SEO — Ambiente de Demonstração Isolado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_ARTICLES.map((article) => (
          <Card key={article.id} className="flex flex-col border-slate-200 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="bg-slate-50 text-[10px] uppercase tracking-wider font-semibold">
                  {article.category}
                </Badge>
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-[10px] uppercase">
                  Rascunho Sintético
                </Badge>
              </div>
              <CardTitle className="text-lg leading-snug">{article.title}</CardTitle>
              <CardDescription className="line-clamp-2 mt-2">{article.excerpt}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Saúde VSEO
                  </span>
                  <span className="font-bold text-primary">85/100</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: '85%' }}></div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 mt-2">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>Meta keywords detectadas (inúteis para Google)</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 pt-0">
              <Button asChild variant="outline" size="sm" className="w-full text-xs">
                <Link to="/vseo-pilot/blog/$slug" params={{ slug: article.slug }}>
                  <Eye className="w-3.5 h-3.5 mr-1.5" /> Visualizar
                </Link>
              </Button>
              <Button disabled variant="default" size="sm" className="w-full text-xs opacity-50 cursor-not-allowed">
                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Editar (Piloto)
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <PilotDisclaimer />
    </div>
  );
}
