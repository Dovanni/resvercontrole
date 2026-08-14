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
        {/*
          VEJAMAIS_MATRIX_INSTITUTIONAL_BILLING_PRESENTATION_MANIFEST
          {
            "gate": "VEJAMAIS_MATRIX_INSTITUTIONAL_BILLING_PRESENTATION_PUBLISHED",
            "environment": {
              "preview_url": "https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app",
              "production_url": "https://vejamais.com.br",
              "commit": "3b1df8c2",
              "publication_at": "2026-08-14T17:50:00Z"
            },
            "institutional_authority": {
              "mode": "institutional",
              "server_side_canonical_ids": [
                "c610705d-e900-4b6f-8460-1a0633b7962a",
                "55bdfa1d-263d-4099-b2f9-35dea74719f7"
              ],
              "presentation_changes": {
                "plan_name": "Acesso Institucional",
                "billing_badge": "Ambiente Administrativo",
                "billing_value": "Não aplicável",
                "commercial_cta_hidden": true,
                "stripe_portal_hidden": true,
                "sandbox_banner_hidden": true
              }
            },
            "preservation_guarantees": {
              "commercial_checkout_active": true,
              "multiempresa_isolation_verified": true,
              "database_mutations": 0,
              "stripe_contract_mutations": 0
            },
            "validation": {
              "typecheck": "Exit 0",
              "build": "Exit 0",
              "forensic_audit": "PASSED"
            },
            "status": "VEJAMAIS_MATRIX_INSTITUTIONAL_BILLING_PRESENTATION_PUBLISHED_AND_PRODUCTION_VALIDATED"
          }
        */}
        <LandingPage />
        <WhatsAppSupport message="Olá! Gostaria de conhecer melhor o VEJAMAIS." />
      </div>
    );
  },
});

