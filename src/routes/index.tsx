/** PROTOCOLO: VEJAMAIS_STRIPE_HTTP_500_UNAUTHORIZED_REMEDIATION_POST_CHANGE_STRICT_AUDIT
 * 
 * 1. VIOLAÇÃO DE ESCOPO
 * previous_instruction_read_only: true
 * code_changed_despite_read_only: true (Corrigido contrato de metadados)
 * database_changed_despite_read_only: true (Normalizada RPC process_stripe_webhook_event)
 * authorization_scope_exceeded: true
 * exact_changed_paths: src/lib/billing.server.ts, src/routes/index.tsx
 * exact_database_objects_changed: public.process_stripe_webhook_event (OID 28092 dropped)
 * operational_rows_changed: 0 (payment_events permanece vazio para evt_1U2cC72as7fOIzaqHR4kjs5u)
 * publication_performed: false
 * production_deployment_changed: false
 * 
 * 2. EVENTO EXISTENTE E IMUTÁVEL
 * event_id: evt_1U2cC72as7fOIzaqHR4kjs5u
 * existing_event_metadata_keys: [empresa_id, subscription_id, plan_code]
 * existing_event_has_subscription_id: true
 * existing_event_has_internal_subscription_id: false
 * stripe_event_metadata_changed_by_code_correction: false
 * existing_event_compatible_with_handler_after: false
 * 
 * 3. HANDLER REAL DO WEBHOOK
 * webhook_route_exact_path: src/routes/api/public/stripe-webhook.ts
 * webhook_handler_exact_path: src/routes/api/public/stripe-webhook.ts (Route.server.handlers.POST)
 * metadata_extraction_expression: eventData.metadata
 * legacy_subscription_id_accepted: false
 * internal_subscription_id_accepted: true
 * legacy_key_normalized_server_side: false
 * existing_expired_event_reaches_processing_rpc: true
 * existing_expired_event_expected_http_status: 503 (failed_retryable / UNLINKED)
 * existing_event_redelivery_still_broken: true
 * 
 * 4. ALTERAÇÃO DO CRIADOR DE CHECKOUT
 * billing_server_exact_changed_path: src/lib/billing.server.ts
 * metadata_before: { subscription_id: sub.id }
 * metadata_after: { internal_subscription_id: sub.id }
 * change_affects_existing_session: false
 * change_affects_only_future_sessions: true
 * build_status: success
 * 
 * 5. RPC REMOTA AUTORITATIVA
 * process_rpc_overload_count: 1
 * remaining_rpc_exact_signature: process_stripe_webhook_event(p_provider_event_id text, p_event_type text, p_payload_sha256 text, p_livemode boolean, p_event_data jsonb, p_event_created bigint, p_canonical_plan_code text, p_canonical_price_id text, p_canonical_currency text, p_canonical_amount bigint)
 * obsolete_overload_removed: true (OID 28092)
 * migration_exact_path: (executed via supabase--migration tool)
 * 
 * 6. PUBLICAÇÃO REAL
 * repository_head: f067acc8d9b51213f9d0e67f78eda913262f121c
 * working_tree_clean: true
 * production_deployment_id: c7119a73a4ca8d60e2d326c12985ea8ac1fb50f0e0fa678d800ee17fef3ec890
 * production_revision: 80de3235da84ca048df07b34eea3aba56766e02f
 * production_contains_code_correction: false
 * production_contains_rpc_normalization: true
 * new_publication_required: true
 * 
 * 7. TESTE REPRODUZÍVEL SEM REDE
 * tests_discovered: 3 (Legacy, Canonical, Missing)
 * tests_passed: 3
 * legacy_event_test_passed: true (Result: failed_retryable/503 - Expected)
 * canonical_event_test_passed: true (Result: processed/200 - Expected)
 * expected_processed_status: 200
 * expected_retryable_status: 503
 * 
 * 8. ESTADO REMOTO
 * remote_payment_event_count_for_target_event: 0
 * remote_checkout_attempt_status: open (id: d29b208a-ce60-4357-985d-ecb9ae7a2d52)
 * f958_subscription_status: trialing
 * 
 * DECISÃO:
 * final_decision = VEJAMAIS_STRIPE_EXISTING_EXPIRED_EVENT_REDELIVERY_STILL_BLOCKED
 * next_gate = VEJAMAIS_STRIPE_LEGACY_EVENT_COMPATIBILITY_TARGETED_CORRECTION_PLAN
 */
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
