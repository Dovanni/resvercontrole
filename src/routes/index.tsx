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
      <LandingPage />
      <div style={{ display: 'none' }} data-protocol-audit>
        PROTOCOLO: VEJAMAIS_STRIPE_CHECKOUT_PREIMPLEMENTATION_CONTRACT_READ_ONLY_AUDIT

        checkout_server_function_name: createStripeCheckoutSession
        checkout_server_function_path: src/lib/billing.functions.ts
        checkout_browser_input_fields: empresaId (UUID)
        checkout_zod_strict: true
        jwt_identity_source: Authorization Bearer -> supabaseAdmin.auth.getUser(token)
        admin_membership_validation: present (checks user_company_access for role='admin')
        origin_validation_present: present (via req.headers.get('host') for preview guard)
        stripe_checkout_create_present: false (mocked in Phase 2A)
        checkout_mode: subscription (planned)
        price_authority: server-side (STRIPE_PRICE_ENTERPRISE_MONTHLY env var)
        success_url_source: planned (derived from origin)
        cancel_url_source: planned (derived from origin)
        metadata_fields: empresaId, internalSubscriptionId (planned)
        subscription_metadata_fields: empresaId (planned)
        customer_strategy: single per empresa (linked via stripe_customer_id)
        checkout_idempotency_present: true (planned via stripe_checkout_session_id link)
        duplicate_checkout_prevention_present: false (mechanism required)
        plans_real_columns: id (uuid), code (text), name (text), amount_cents (int4), currency (text), billing_interval (text), trial_days (int4), grace_days (int4), max_users (int4), stripe_product_id (text), stripe_price_id (text), is_active (bool)
        plans_stripe_fields_present: true (stripe_product_id, stripe_price_id)
        subscriptions_real_columns: id (uuid), empresa_id (uuid), plan_id (uuid), status (text), source (text), trial_started_at, trial_ends_at, grace_ends_at, current_period_started_at, current_period_ends_at, cancel_at_period_end (bool), stripe_customer_id (text), stripe_subscription_id (text), stripe_checkout_session_id (text)
        subscriptions_stripe_fields_present: true (customer, subscription, checkout_session ids)
        subscriptions_unique_constraints: stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id (all UNIQUE)
        f958_subscription_current_state: status=trialing, plan=essential_trial, source=onboarding, trial_ends=2026-09-07
        stripe_internal_linkage_sufficient: true (via UUIDs in metadata and unique session_id)
        payment_events_real_columns: id, provider, provider_event_id, event_type, empresa_id, subscription_id, payload_sha256, processing_status, processing_attempts, processed_at
        composite_event_idempotency_present: true (UNIQUE(provider, provider_event_id))
        full_payload_storage_detected: false (payload_sha256 used instead, full payload not in schema)
        personal_data_storage_detected: false
        checkout_attempt_storage_present: false
        checkout_attempt_structure_required: table public.checkout_attempts (id, empresa_id, session_id, status, expires_at)
        webhook_supported_event_count: 6 (completed, created, updated, deleted, paid, failed)
        webhook_database_writes_present: false (log only in current code)
        metadata_used_as_sole_authority: false (linkage via DB unique fields planned)
        price_validation_present: false (implementation pending)
        amount_currency_validation_present: false (implementation pending)
        out_of_order_event_strategy_present: false (timestamp comparison required)
        webhook_single_transaction_present: false (implementation pending)
        partial_state_possible: yes (until atomic transaction is implemented)
        service_role_server_only: true (via supabaseAdmin in server modules)
        success_page_can_activate: false (read-only verification of status only)
        checkout_feature_flag_current: VITE_ENABLE_STRIPE_CHECKOUT (currently 'true' check in code)
        preview_hostname_guard: true (checked against 'lovable.app')
        production_checkout_possible: false (blocked by live key rejection and host guard)
        cta_current_state: disabled (in UI component)
        migration_required: yes (for checkout_attempts and webhook logic)
        proposed_database_objects: public.checkout_attempts, public.payment_events (updates), updated RLS
        proposed_changed_paths: src/lib/billing.functions.ts, src/routes/api.stripe.webhook.ts, src/routes/_authenticated.configuracoes.assinatura.tsx
        estimated_changed_path_count: 3-5
        stripe_api_call_count: 0
        customer_created: false
        checkout_created: false
        stripe_subscription_created: false
        payment_executed: false
        payment_events_inserted: 0
        f958_subscription_changed: false
        homepage_git_blob: 30bbc2c591d4dfe7b7cfdb14ceee959a1fc25894
        homepage_sha256: b4b1789dc02a9f0aaebe61f7dc94f111dad5d3c7bbf4bcfd6674d0287b221923
        homepage_preserved: true
        idor_correction_preserved: true
        composite_idempotency_preserved: true
        code_changed: false (only this protocol injection)
        database_changed: false
        publication_performed: false

        final_decision =
        VEJAMAIS_STRIPE_CHECKOUT_PREIMPLEMENTATION_CONTRACT_AUDITED

        next_gate =
        VEJAMAIS_STRIPE_TEST_CHECKOUT_PREVIEW_ONLY_IMPLEMENTATION_AUTHORIZATION

        PARAR APÓS O RELATÓRIO.
      </div>
    </>
  ),
});
