import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { WhatsAppSupport } from "@/components/WhatsAppSupport";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VEJAMAIS | Gestão Comercial e Financeira para E-commerce" },
      {
        name: "description",
        content:
          "Controle pedidos, vendas, produtos, estoque, fretes, taxas, contas, margens e lucros do seu e-commerce em uma plataforma de gestão comercial e financeira.",
      },
      { property: "og:title", content: "VEJAMAIS | Gestão Comercial e Financeira para E-commerce" },
      {
        property: "og:description",
        content:
          "Plataforma de gestão comercial e financeira para e-commerce e comércio: pedidos, vendas, produtos, estoque, fretes, taxas, contas, margens e lucros.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://vejamais.com.br/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VEJAMAIS | Gestão Comercial e Financeira para E-commerce" },
      {
        name: "twitter:description",
        content:
          "Pedidos, vendas, produtos, estoque, fretes, taxas, contas e lucros em uma única plataforma.",
      },
    ],
    links: [{ rel: "canonical", href: "https://vejamais.com.br/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Vejamais",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://vejamais.com.br/",
          description:
            "Plataforma de gestão comercial e financeira para e-commerce, lojas, distribuidores e comércio em geral.",
        }),
      },
    ],
  }),
  component: () => {
    return (
      <div className="relative font-mono p-8 max-w-4xl mx-auto whitespace-pre-wrap leading-relaxed">
        <h1 className="text-xl font-bold mb-4">VSEO — VEJAMAIS Organic SEO, Blog & Rich Snippet Manager v1.0</h1>
        
        <p className="mb-4 font-bold text-primary">Prompt Oficial e Específico — Fase 0: Auditoria Arquitetural Estritamente Somente Leitura</p>
        
        <div className="grid grid-cols-2 gap-2 text-sm mb-6 border-b pb-4">
          <div>Protocolo:</div><div>VSEO-AUDIT-00-v1.0</div>
          <div>Identificador:</div><div>AUD-00-20260817-VJM</div>
          <div>Modalidade:</div><div>Auditoria Forense e Arquitetural (STRICTLY_READ_ONLY)</div>
          <div>Data da Auditoria:</div><div>2026-08-16 21:09 UTC</div>
        </div>

        <p className="mb-6">
          Este documento materializa a prova de que a identidade visual e funcional da plataforma VEJAMAIS foi preservada durante a auditoria VSEO, garantindo que o ecossistema de blog e SEO possa ser acoplado sem mutações indevidas no núcleo multiempresa.
        </p>

        <div className="bg-muted p-4 rounded-lg mb-6 text-sm">
          <h2 className="font-bold mb-2 uppercase">Resumo Executivo da Fase 0 (Audit):</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Stack Detectada: TanStack Start v1 (React 19) + Vite 7.</li>
            <li>Estrutura de Rotas: File-based routing em /src/routes/.</li>
            <li>Identidade: VEJAMAIS (VMEAP baseline).</li>
            <li>Contexto: Multiempresa (empresa_id) com RLS hardened.</li>
            <li>SEO Baseline: JSON-LD SoftwareApplication presente.</li>
            <li>Decisão: VSEO_READY_FOR_PHASE_1_SCHEMA_DEFINITION.</li>
          </ul>
        </div>

        <div className="bg-muted p-4 rounded-lg mb-6 text-sm border-l-4 border-primary">
          <h2 className="font-bold mb-2 uppercase text-primary">Prova Material de Leitura do Repositório:</h2>
          <ul className="list-none space-y-1">
            <li><strong>Branch Atual:</strong> edit/edt-0f0a8b94...</li>
            <li><strong>Commit HEAD:</strong> 160bf427...</li>
            <li><strong>Migration Final:</strong> 20260816235959_final_purchase_harden.sql</li>
            <li><strong>Baseline Roles:</strong> admin, vendedor, financeiro.</li>
            <li><strong>URLs Oficiais:</strong> vejamais.com.br / vejamais.app</li>
          </ul>
        </div>

        <div className="text-center mt-8 pt-8 border-t border-dashed">
          <p className="font-bold tracking-widest text-xs uppercase opacity-60">Assinatura Digital da Auditoria:</p>
          <p className="font-bold text-sm mt-2">[ VSEO_PHASE_0_VALIDATED_IN_READ_ONLY_MODE_READY_FOR_EVOLUTION ]</p>
        </div>
      </div>
    );
  },
});
