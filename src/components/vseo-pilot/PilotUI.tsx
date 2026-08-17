
import React from 'react';

export const PilotBadge: React.FC = () => (
  <div className="bg-amber-100 border-y border-amber-200 py-1.5 px-4 text-center z-[100] relative">
    <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1">
      <span className="text-[10px] font-bold text-amber-900 tracking-wider uppercase">
        AMBIENTE PILOTO ISOLADO
      </span>
      <span className="text-[10px] font-medium text-amber-800 uppercase opacity-80">
        DADOS 100% SINTÉTICOS
      </span>
      <span className="text-[10px] font-medium text-amber-800 uppercase opacity-80">
        NENHUMA INFORMAÇÃO SERÁ SALVA
      </span>
      <span className="text-[10px] font-bold text-red-700 uppercase">
        NÃO PUBLICAR EM PRODUÇÃO
      </span>
    </div>
  </div>
);

export const PilotDisclaimer: React.FC = () => (
  <div className="text-xs text-muted-foreground mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg italic space-y-2">
    <p>
      VSEO — VEJAMAIS ERP Organic SEO, Blog & Rich Snippet Manager v1.0
    </p>
    <p>
      As análises deste piloto são orientativas. O Google pode reescrever títulos e snippets e não existe garantia de posicionamento ou rich result.
    </p>
  </div>
);
