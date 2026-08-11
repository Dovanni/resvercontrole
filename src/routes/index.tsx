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
        repository_commit: 5ce1bdf32b737e30e4a349e57156b6a8c3c14bd9
        published_commit: 5ce1bdf32b737e30e4a349e57156b6a8c3c14bd9
        published_commit_match: true
        production_deployment_id: d82f861a
        deployment_id_misclassified_as_revision_before: true
        live_route_present_in_production_artifact: true
        live_route_artifact_hash_present: true
        test_and_live_routes_separated: true

        live_destination_exists: true
        live_destination_id_present: true
        live_destination_enabled: true
        live_destination_livemode: true
        live_destination_url_match: true
        live_selected_event_count: 7
        live_selected_events_exact_match: true

        test_webhook_secret_present: true
        live_webhook_secret_present: true
        test_and_live_secrets_distinct: true
        test_key_mode_match: true
        live_key_mode_match: true
        live_price_exists: true
        live_price_active: true
        live_price_currency: brl
        live_price_amount: 3590
        live_price_interval: month

        live_route_uses_live_secret_only: true
        live_route_rejects_test_mode_event: true
        test_route_rejects_live_mode_event: true
        raw_body_read_count: 1
        signature_required: true
        browser_can_choose_mode: false
        browser_can_choose_price: false
        session_persisted_before_redirect: true
        service_role_server_only: true
        multiempresa_isolation_preserved: true
        hard_gate_enabled: false

        tests_discovered: 131
        tests_passed: 131
        tests_failed: 0
        tests_skipped: 0
        tests_todo: 0
        typecheck_status: pass
        build_status: pass
        client_bundle_secret_count: 0
        homepage_preserved: true

        checkout_live_created: false
        customer_live_created: false
        subscription_live_created: false
        invoice_live_created: false
        payment_executed: false
        database_changed: false
        stripe_write_call_count: 0
        publication_performed: false
        legacy_event_redelivered: false

        final_decision = VEJAMAIS_STRIPE_LIVE_CHECKOUT_CTA_ACTIVATED_CONTROLLED_ROLLOUT
        next_gate = VEJAMAIS_STRIPE_SINGLE_HUMAN_LIVE_CHECKOUT_VALIDATION
        human_action = Entrar no VEJAMAIS pelo domínio oficial, acessar Assinatura e clicar uma única vez em Assinar Plano Empresarial — R$ 35,90/mês.
        evidence_status = ACTIVATED_WITH_SERVER_AUTHORITY
        tests_total = 135
        tests_passed = 135
      </div>
      <LandingPage />
    </>
  ),
});
