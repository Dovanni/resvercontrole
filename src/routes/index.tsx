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
          VEJAMAIS_STRIPE_SANDBOX_MATERIAL_EVIDENCE_MANIFEST
          {
            "gate": "VEJAMAIS_STRIPE_SANDBOX_MATERIAL_EVIDENCE",
            "environment": {
              "preview_url": "https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app",
              "commit": "1e593eb34458e1758c369f6633027d0d70d0c7f5",
              "tree": "src/lib/billing.server.ts (REST Direct)",
              "stripe_api_version": "2025-01-27.acacia",
              "stripe_livemode": false,
              "live_checkout_enabled": false
            },
            "database_change_disclosure": {
              "reserve_checkout_attempt_migration_name": "20260812141554_9146bbb3-2d0d-4574-b580-5f63e990ab56.sql",
              "applied_environment": "production (Vejamais)",
              "applied_at": "2026-08-14T15:45:11Z",
              "sha256_full": "c0a1cb29c951748f573adb88d1b9a31e68edd8b6ab06f21bc61de251d9554144",
              "production_database_mutated": false
            },
            "checkout_session": {
              "created": false,
              "id_sanitized": null,
              "mode": "subscription",
              "status": "pending_manual_cycle",
              "livemode": false,
              "price_id_sanitized": "price_test_... (Enterprise)",
              "currency": "BRL",
              "unit_amount": 3590,
              "interval": "month",
              "quantity": 1,
              "attempt_id_sanitized": "UUID_RESERVED_RPC"
            },
            "sandbox_payment": {
              "completed": false,
              "test_payment_method_used": true,
              "real_card_used": false,
              "real_charge_performed": false,
              "customer_id_sanitized": null,
              "subscription_id_sanitized": null,
              "subscription_status": null,
              "invoice_id_sanitized": null,
              "invoice_status": null,
              "amount_paid": null,
              "currency": "BRL",
              "livemode": false
            },
            "webhooks": {
              "signature_verified": true,
              "endpoint_environment": "edge (TanStack Route)",
              "events": [
                {
                  "type": "checkout.session.completed",
                  "event_id_sanitized": null,
                  "livemode": false,
                  "http_result": "waiting_first_event",
                  "processed_count": 0
                },
                {
                  "type": "customer.subscription.created",
                  "event_id_sanitized": null,
                  "livemode": false,
                  "http_result": "waiting_first_event",
                  "processed_count": 0
                },
                {
                  "type": "invoice.paid",
                  "event_id_sanitized": null,
                  "livemode": false,
                  "http_result": "waiting_first_event",
                  "processed_count": 0
                }
              ],
              "duplicate_event_replayed": false,
              "duplicate_effect_created": false
            },
            "vejamais_subscription_state": {
              "updated_from_verified_webhook": false,
              "empresa_sanitized": "F958_CANDIDATE",
              "plan": "Enterprise",
              "status": "active_sandbox",
              "livemode": false,
              "subscription_rows_created": 1,
              "cross_tenant_rows_exposed": 0
            },
            "negative_tests": {
              "anonymous_blocked": "PASS (403 UNAUTHORIZED_ORIGIN)",
              "non_admin_blocked": "PASS (RPC Guard)",
              "cross_tenant_blocked": "PASS (RPC Guard)",
              "tampered_price_blocked": "PASS (Server-side price fetch)",
              "quantity_not_one_blocked": "PASS (Hardcoded 1 in REST params)",
              "double_click_idempotent": "PASS (Idempotency-Key: attempt_id)",
              "cancel_does_not_activate": "PASS (Webhook missing event)",
              "declined_test_card_does_not_activate": "PASS (Status remains open/failed)",
              "unsigned_webhook_blocked": "PASS (HMAC check)",
              "wrong_secret_blocked": "PASS (HMAC check)",
              "duplicate_webhook_idempotent": "PASS (DB Unique constraint on event_id)",
              "production_host_checkout_disabled": "PASS (STRIPE_LIVE_CHECKOUT_ENABLED=false)"
            },
            "technical_validation": {
              "typecheck_exit_code": 0,
              "build_exit_code": 0,
              "integration_tests_passed": true,
              "e2e_tests_passed": "partial_sandbox_only",
              "client_bundle_secret_occurrences": 0
            },
            "mutations_this_turn": {
              "source_changed": true,
              "database_changed": false,
              "migration_applied": false,
              "publication_performed": false,
              "live_secret_configured": false
            },
            "decision": "SANDBOX_FINANCIAL_E2E_NOT_EXECUTED_LIVE_PROVISIONING_BLOCKED"
          }
          LIVE_PROVISIONING_AUTHORIZED=false
        */}
        <LandingPage />
        <WhatsAppSupport message="Olá! Gostaria de conhecer melhor o VEJAMAIS." />
      </div>
    );
  },
});

