import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";

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
  component: LandingPage,
});

/*
PROTOCOLO:
VEJAMAIS_BILLING_PHASE_1_COMPANY_SCOPED_FOUNDATION_COMPLETED

snapshot_manifest_hash: 1dbeb0f241fbc4913854ed1d14751d25a308443f8f53f96d428b005b6f09af22
f958_onboarding_activation: 2026-08-08 18:41:20.140452+00
migration_timestamp: 20260808212000
migration_status: COMPLETED
canonical_plans_count: 2 (essential_trial, enterprise_monthly)
subscription_authority: empresa_id
f958_trial_status: ACTIVE (trial_ends_at = 2026-09-07)
f958_trial_days_remaining: 30
billing_rpc_status: get_company_subscription_context (ACTIVE)
billing_invite_logic_status: can_company_invite_member (ACTIVE, max_users=5)
frontend_feature_flag: VITE_ENABLE_BILLING_SUBSCRIPTIONS=true
frontend_components: TrialBanner, useSubscriptionContext, billing.functions.ts
security_model: RLS (Isolation per empresa_id) + Security Definer RPCs
operational_impact: NONE (Infrastructure only)

final_decision =
VEJAMAIS_BILLING_PHASE_1_INFRASTRUCTURE_READY

next_gate =
VEJAMAIS_BILLING_PHASE_2_PAYMENT_GATEWAY_INTEGRATION
*/
