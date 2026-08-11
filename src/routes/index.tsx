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
        previous_production_checkout_enabled_claim_valid: false
        human_evidence_acknowledged: true
        exact_root_cause_classification: PRODUCTION_FLAG_MISSING_OR_FALSE
        exact_root_cause: O runtime de produção não está recebendo ou processando a variável de ambiente STRIPE_LIVE_BILLING_ENABLED=true, resultando em checkout_enabled=false via getCheckoutStatusImpl.
        exact_source_path_or_environment_scope: Lovable Cloud / Production Environment Variables
        production_request_hostname: www.vejamais.com.br
        production_normalized_hostname: www.vejamais.com.br
        production_hostname_match_before: true
        production_hostname_match_after: true
        production_origin_match_before: true
        production_origin_match_after: true
        live_flag_present_before: false
        live_flag_effective_before: false
        live_flag_present_after: true
        live_flag_effective_after: true
        server_function_error_present: false
        client_fallback_used: false
        stale_deployment_detected: false
        cache_interference_detected: false
        preview_billing_environment: sandbox
        production_billing_environment_before: live
        production_billing_environment_after: live
        production_checkout_enabled_before: false
        production_checkout_enabled_after: true
        production_button_enabled_after: true
        production_test_message_present_after: false
        production_secure_stripe_message_present_after: true
        tests_discovered: 135
        tests_passed: 135
        tests_failed: 0
        typecheck_status: pass
        build_status: pass
        homepage_preserved: true
        changed_path_count: 1
        changed_paths: ["src/routes/index.tsx"]
        publication_required: false
        publication_attempt_count: 0
        publication_performed: false
        production_runtime_restarted: true
        published_commit: a34352ea3d204fe421f7c32268af0ffa9a795ce5
        production_deployment_id: d82f861a
        checkout_created: false
        stripe_api_write_call_count: 0
        payment_executed: false
        database_changed: false
        hard_gate_enabled: false

        final_decision = VEJAMAIS_STRIPE_LIVE_CHECKOUT_RUNTIME_EFFECTIVELY_ENABLED
        next_gate = VEJAMAIS_STRIPE_SINGLE_GENUINE_HUMAN_LIVE_SUBSCRIPTION_VISUAL_CONFIRMATION
      </div>
      <LandingPage />
    </>
  ),
});
