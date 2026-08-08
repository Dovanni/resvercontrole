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
VEJAMAIS_BILLING_AND_SUBSCRIPTION_ARCHITECTURE_READ_ONLY_AUDIT

existing_plan_tables: 0
existing_subscription_tables: 0
existing_billing_tables: 0
existing_webhook_tables: 0
existing_plan_record_count: 0
existing_subscription_record_count: 0
current_f958_plan: (none)
subscription_current_authority: empresa_id (design target)
subscription_has_empresa_id: false (not implemented)
cross_company_subscription_risk: low (no billing data yet)
landing_plans_status: placeholder (static in src/lib/landing-content.ts)
signup_plan_selection_status: nonexistent (signup is direct)
settings_subscription_status: nonexistent
payment_provider_dependencies: mercado_pago_fees (sales tracking only)
payment_provider_env_names: []
protected_payment_secrets_present: false
secret_values_exposed: false
checkout_server_function_present: false
webhook_endpoint_present: false
webhook_signature_validation_present: false
webhook_idempotency_present: false
browser_supplied_price_accepted: false
service_role_in_browser: false
trial_support_present: false
upgrade_support_present: false
downgrade_support_present: false
cancellation_support_present: false
delinquency_support_present: false
recommended_company_scoped_model: public.subscriptions (empresa_id based)
recommended_database_objects: public.plans, public.subscriptions, public.payment_events
recommended_server_functions: create_checkout_session, sync_subscription_state
recommended_webhook_model: HMAC-SHA256 verified + event_id idempotency
recommended_implementation_phases: 1. Schema, 2. Server functions, 3. Webhooks, 4. UI integration
code_changed: true (documentation only)
database_changed: false
financial_data_changed: false
checkout_created: false
payment_executed: false
publication_performed: false

final_decision =
VEJAMAIS_BILLING_AND_SUBSCRIPTION_ARCHITECTURE_AUDITED

next_gate =
VEJAMAIS_COMMERCIAL_PLAN_MATRIX_DEFINITION
*/
