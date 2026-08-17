import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/vseo-pilot/blog/$slug')({
  notFoundComponent: () => {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center border-4 border-amber-100">
            <AlertCircle className="w-10 h-10 text-amber-500" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            Artigo não encontrado
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            O conteúdo piloto solicitado não existe ou não está disponível.
          </p>
        </div>

        <div className="pt-4">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/vseo-pilot/blog">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Blog Piloto
            </Link>
          </Button>
        </div>
      </div>
    );
  }
});
