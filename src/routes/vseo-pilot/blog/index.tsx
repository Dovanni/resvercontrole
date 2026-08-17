import { createFileRoute, Link } from '@tanstack/react-router';
import { MOCK_ARTICLES } from '@/features/vseo-pilot/mockArticles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, FileText } from 'lucide-react';

export const Route = createFileRoute('/vseo-pilot/blog/')({
  component: PilotBlogIndex,
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
      { title: 'Blog Piloto | VSEO Pilot' }
    ]
  })
});

function PilotBlogIndex() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Blog VEJAMAIS ERP</h1>
        <p className="text-xl text-muted-foreground">Conteúdo educativo sobre gestão e tecnologia</p>

      </div>

      <div className="grid gap-8">
        {MOCK_ARTICLES.map((article) => (
          <Link 
            key={article.id} 
            to="/vseo-pilot/blog/$slug" 
            params={{ slug: article.slug }}
            className="group block"
          >
            <Card className="overflow-hidden border-slate-200 group-hover:border-primary/40 transition-all group-hover:shadow-md">
              <div className="md:flex">
                <div className="md:w-1/3 bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center min-h-[200px] border-r border-slate-100 p-6">
                   <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <FileText className="w-6 h-6 text-primary/60" />
                      </div>
                      <div className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider leading-tight">
                        {article.imageAlt}
                      </div>
                   </div>
                </div>
                <div className="md:w-2/3 p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                      {article.category}
                    </Badge>
                  </div>
                  <CardHeader className="p-0">
                    <CardTitle className="text-2xl group-hover:text-primary transition-colors leading-tight">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="text-base line-clamp-3 mt-2">
                      {article.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" /> {article.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" /> 17 Ago, 2026
                    </span>
                  </CardContent>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
