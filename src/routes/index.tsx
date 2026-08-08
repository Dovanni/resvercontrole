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
VEJAMAIS_BILLING_PHASE_1_TARGETED_SAFETY_AND_UX_COMPLETED

preconditions_match: YES
migration_name: 20260808212921_cca5c478-hardening
migration_applied: YES
plans_full_public_select_revoked: YES
plans_public_column_grants: 15 columns
subscriptions_access_via_rpc_only: YES
payment_events_public_access: NONE (service_role only)
runtime_hostname_guard_present: YES
allowed_preview_hostnames: id-preview..., localhost, 127.0.0.1
blocked_production_hostnames: resvercontrole..., vejamais..., www.vejamais...
canonical_subscription_url: /configuracoes/assinatura
internal_route_filename: configuracoes.assinatura.tsx
milestone_modal_implemented: YES (15, 7, 3, 1, 0 days)
milestone_local_storage_isolated: YES (user:company:ends:milestone)
preview_simulation_available: YES (?previewTrialMilestone=X)
checkout_created: NO
stripe_api_called: NO
f958_subscription_changed: NO
snapshot_manifest_match: 1dbeb0f2...
typecheck_status: PASS
build_status: PASS

final_decision =
VEJAMAIS_BILLING_PHASE_1_SAFETY_AND_UX_COMPLETED

next_gate =
VEJAMAIS_BILLING_PHASE_1_HUMAN_VISUAL_VALIDATION
*/
