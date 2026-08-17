
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';

export const PilotBadge: React.FC = () => (
  <div className="bg-amber-100 border-b border-amber-200 py-1.5 px-4 text-center z-[100] relative">
    <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1">
      <div className="flex items-center gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
        <span className="text-[10px] font-bold text-amber-900 tracking-wider uppercase">
          AMBIENTE PILOTO ISOLADO
        </span>
      </div>
      <span className="text-[10px] font-medium text-amber-800 uppercase opacity-80">
        DADOS 100% SINTÉTICOS
      </span>
      <span className="text-[10px] font-medium text-amber-800 uppercase opacity-80">
        NENHUMA INFORMAÇÃO SERÁ SALVA
      </span>
      <Badge variant="outline" className="text-[9px] h-4 border-red-200 text-red-700 uppercase bg-red-50 font-bold">
        NÃO PUBLICAR EM PRODUÇÃO
      </Badge>
    </div>
  </div>
);

export const PilotDisclaimer: React.FC = () => (
  <div className="text-[11px] text-muted-foreground mt-8 p-6 bg-slate-50 border border-slate-200 rounded-xl italic space-y-3">
    <div className="flex items-center gap-2 not-italic">
      <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
      <span className="font-semibold text-slate-700">Denominação Institucional:</span>
    </div>
    <p className="pl-3.5">
      VSEO — VEJAMAIS ERP Organic SEO, Blog & Rich Snippet Manager v1.0
    </p>
    <p className="pl-3.5 opacity-80">
      As análises deste piloto são orientativas baseadas em boas práticas da indústria. O Google e outros motores de busca reservam-se o direito de reescrever títulos, descrições e snippets de acordo com a intenção de busca do usuário e algoritmos proprietários. O uso deste gestor não garante posicionamento orgânico ou exibição de rich snippets.
    </p>
  </div>
);
