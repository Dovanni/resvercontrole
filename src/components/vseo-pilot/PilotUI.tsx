
import React from 'react';

export const PilotBadge: React.FC = () => (
  <div className="bg-amber-100 border-y border-amber-200 py-1 px-4 text-center">
    <span className="text-xs font-bold text-amber-800 tracking-tight uppercase">
      PILOTO — CONTEÚDO SINTÉTICO — NÃO PUBLICADO
    </span>
  </div>
);

export const PilotDisclaimer: React.FC = () => (
  <div className="text-xs text-muted-foreground mt-4 p-3 bg-slate-50 border border-slate-100 rounded-md italic">
    As análises deste piloto são orientativas. O Google pode reescrever títulos e snippets e não existe garantia de posicionamento ou rich result.
  </div>
);
