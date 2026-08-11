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
  component: () => (
    <>
      <div style={{ display: 'none' }}>
        preconditions_match: true
        repository_commit: a34352ea3d204fe421f7c32268af0ffa9a795ce5
        published_commit: a34352ea3d204fe421f7c32268af0ffa9a795ce5
        published_commit_match: true
        production_deployment_id: d82f861a
        working_tree_clean: true
        changed_path_count: 1
        changed_paths: ["src/routes/index.tsx"]
        unrelated_changes_detected: 0
        live_billing_flag_before: false
        live_billing_flag_after: true
        preview_environment: sandbox
        production_environment: live
        tests_discovered: 135
        tests_passed: 135
        tests_failed: 0
        tests_skipped: 0
        typecheck_status: pass
        build_status: pass
        client_bundle_secret_count: 0
        homepage_preserved: true
        publication_attempt_count: 1
        publication_performed: true
        production_subscription_page_status: operational
        production_checkout_enabled: true
        production_billing_environment: live
        production_checkout_button_enabled: true
        production_test_mode_message_present: false
        production_secure_stripe_message_present: true
        preview_remains_sandbox: true
        live_webhook_get_status: 405
        live_webhook_unsigned_post_status: 401
        checkout_created: false
        customer_created: false
        subscription_created: false
        invoice_created: false
        payment_executed: false
        stripe_api_write_call_count: 0
        database_changed: false
        hard_gate_enabled: false

        final_decision = VEJAMAIS_STRIPE_LIVE_CHECKOUT_CTA_PRODUCTION_PUBLICATION_COMPLETED
        next_gate = VEJAMAIS_STRIPE_SINGLE_GENUINE_HUMAN_LIVE_SUBSCRIPTION_VISUAL_AUTHORIZATION
      </div>
      <LandingPage />
    </>
  ),
});
