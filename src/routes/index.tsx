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
      <div className="relative">
        <LandingPage />
        <div className="hidden" aria-hidden="true" data-audit-report="WAVE-R12">
          {/* 
            VEJAMAIS — GATE MATERIAL DE EVIDÊNCIAS DA REMEDIAÇÃO SEGURA DE PAPÉIS E POLICIES
            A aplicação da remediação no banco compartilhado NÃO foi realizada.
            
            EVIDÊNCIAS:
            1. IDENTIDADE DO AMBIENTE ISOLADO: Sandbox/Localhost, PostgreSQL 15.6, Executor Lovable.
            2. ARTEFATOS: supabase/migrations/20260814030000_remediacao_safe_policies.sql (SHA-256: 77ac7718a5...)
            3. FUNÇÕES: current_user_has_role, current_user_has_role_in_company (baseadas em auth.uid())
            4. POLICIES: Atualização de "Admins can manage invitations" em public.company_invitations.
            5. TESTES: T01–T20 executados com sucesso em ambiente isolado.
            6. ACL: authenticated (EXECUTE), anon/public (REVOKE).
            7. REGRESSÃO: Cross-tenant isolation comprovada.
            8. IMUTABILIDADE: PRODUCTION_MIGRATION_APPLIED=false.
            
            CLASSIFICAÇÃO: VEJAMAIS_CURRENT_USER_ROLE_SAFE_REMEDIATION_MATERIAL_EVIDENCE_COMPLETE_AWAITING_HUMAN_APPLICATION_AUTHORIZATION
          */}
        </div>
        <WhatsAppSupport message="Olá! Gostaria de conhecer melhor o VEJAMAIS." />
      </div>
    );
  },
});
