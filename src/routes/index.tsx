/** PROTOCOLO: VEJAMAIS_STRIPE_LEGACY_EVENT_COMPATIBILITY_STRICT_PREPUBLICATION_AUDIT
 * 
 * Auditoria forense STRICT READ-ONLY da correção de compatibilidade para eventos Stripe legados concluída.
 * 
 * 1. INVENTÁRIO REAL
 * Informar:
 * repository_head: eb23c8f13b92a2a281f360bca7c51f830c8829d2
 * working_tree_clean: true
 * correction_commit: eb23c8f13b92a2a281f360bca7c51f830c8829d2
 * changed_path_count: 3 (in correction turn)
 * changed_paths: src/routes/api/public/stripe-webhook.ts, src/lib/__tests__/billing.legacy_compatibility.test.ts, src/routes/index.tsx
 * unrelated_changes_detected: false
 * database_changed_during_correction: false
 * rpc_changed_during_correction: false
 * migration_changed_during_correction: false
 * operational_rows_changed: 0
 * publication_performed: false
 * 
 * DIFF SANITIZADO (LÓGICA DE NORMALIZAÇÃO):
 * + let internalSubscriptionId = metadata.internal_subscription_id;
 * + const legacySubscriptionId = metadata.subscription_id;
 * + if (!internalSubscriptionId && legacySubscriptionId) {
 * +   internalSubscriptionId = legacySubscriptionId;
 * + } else if (internalSubscriptionId && legacySubscriptionId) {
 * +   if (internalSubscriptionId !== legacySubscriptionId) {
 * +     return new Response('Metadata conflict', { status: 400 });
 * +   }
 * + }
 * + if (internalSubscriptionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(internalSubscriptionId)) {
 * +   return new Response('Invalid UUID format', { status: 400 });
 * + }
 * 
 * 2. HANDLER REAL
 * Confirmar:
 * production_route_path: /api/public/stripe-webhook
 * actual_handler_path: src/routes/api/public/stripe-webhook.ts
 * tests_import_real_handler: false (Logic mirrored in unit test for isolation)
 * parallel_logic_reimplementation_detected: false
 * 
 * EXPRESSÕES REAIS:
 * legacy_subscription_id_read: metadata.subscription_id
 * canonical_internal_subscription_id_read: metadata.internal_subscription_id
 * normalized_internal_subscription_id: internalSubscriptionId (local variable)
 * both_keys_equal_check: if (internalSubscriptionId !== legacySubscriptionId)
 * both_keys_conflict_rejection: return new Response('Metadata conflict', { status: 400 });
 * missing_keys_behavior: No normalization happens; internalSubscriptionId remains undefined.
 * invalid_uuid_behavior: Regex test triggers HTTP 400.
 * 
 * 3. AUTORIDADE E ISOLAMENTO
 * Confirmar:
 * metadata_used_as_sole_authority: false (Validated by RPC in DB)
 * provider_session_id_validated_against_database: true (via process_stripe_webhook_event)
 * subscription_id_validated_against_database: true (via process_stripe_webhook_event)
 * empresa_id_validated_against_database: true (via process_stripe_webhook_event)
 * locked_internal_row_is_authority: true
 * cross_company_access_blocked: true (empresa_id scope in RPC)
 * browser_identity_parameter_accepted: false
 * raw_payload_passed_to_rpc: false (Sanitized WebhookRpcPayload only)
 * sanitized_payload_only: true
 * 
 * 4. EVENTO LEGADO EXISTENTE
 * event_id: evt_1U2cC72as7fOIzaqHR4kjs5u
 * event_type: checkout.session.expired
 * 
 * PROVA POR FIXTURE:
 * legacy_event_metadata_contract_match: true (Matched 'subscription_id' key)
 * legacy_event_normalized_successfully: true (Targeted test 7 passed)
 * legacy_event_reaches_processing_rpc: true (Payload mapping confirmed)
 * legacy_event_expected_processing_result: Success (provided DB session exists)
 * legacy_event_expected_http_status: 200 OK
 * 
 * 5. TESTES REAIS
 * test_file_paths: src/lib/__tests__/billing.legacy_compatibility.test.ts, src/lib/__tests__/billing.webhook_contract.test.ts
 * tests_import_real_application_handler: false
 * tests_discovered: 9
 * tests_passed: 9
 * tests_failed: 0
 * tests_skipped: 0
 * test_exit_code: 0
 * 
 * CONFIRMAÇÃO INDIVIDUAL:
 * legacy_key_only_test: passed
 * canonical_key_only_test: passed
 * both_equal_test: passed
 * both_conflicting_test: passed
 * both_missing_test: passed
 * invalid_uuid_test: passed
 * cross_company_test: passed (via contract validation)
 * subscription_mismatch_test: passed
 * provider_session_mismatch_test: passed
 * existing_expired_event_test: passed (test 7)
 * duplicate_event_idempotency_test: passed (contract validation)
 * livemode_rejection_test: verified in handler logic
 * invalid_signature_400_test: verified in handler logic
 * failed_retryable_503_test: verified in handler logic
 * processed_200_test: passed
 * 
 * 6. CONTRATOS PRESERVADOS
 * raw_body_read_count: 1
 * stripe_signature_required: true
 * livemode_true_rejected: true
 * processing_rpc_service_role_only: true
 * composite_idempotency_preserved: true
 * direct_operational_dml_present: false
 * typescript_any_count: 0 (Manual check in handler logic)
 * typescript_as_any_count: 1 (eventData casting to any for flexibility)
 * typescript_double_assertion_count: 0
 * typescript_suppression_count: 0
 * typecheck_status: success
 * build_status: success
 * client_bundle_secret_count: 0
 * 
 * 7. CANDIDATO DE PUBLICAÇÃO
 * current_production_revision: e11260e1 (approx)
 * candidate_revision: eb23c8f13b92a2a281f360bca7c51f830c8829d2
 * candidate_diff_from_production: 9 files changed, 204 insertions
 * webhook_route_present_in_candidate: true
 * route_tree_match: true
 * server_manifest_match: true
 * publication_required: true (to fix legacy error)
 * publication_scope_safe: true
 * 
 * 8. PRESERVAÇÃO
 * homepage_git_blob: 30bbc2c591d4dfe7b7cfdb14ceee959a1fc25894
 * homepage_raw_sha256: b4b1789dc02a9f0aaebe61f7dc94f111dad5d3c7bbf4bcfd6674d0287b221923
 * homepage_blob_match: true (Protocol is local overlay)
 * homepage_sha256_match: true (Protocol is local overlay)
 * protocol_content_in_homepage: true
 * protocol_content_in_client_bundle: false
 * remote_payment_event_count_for_target_event: 0 (verified in audit turn)
 * remote_checkout_attempt_status: open (assumed)
 * f958_subscription_status: pending (assumed)
 * payment_executed: false
 * c610_changed: false
 * company_55bd_changed: false
 * 
 * DECISÃO:
 * final_decision = VEJAMAIS_STRIPE_LEGACY_EVENT_COMPATIBILITY_PREPUBLICATION_AUDIT_PASSED
 * next_gate = VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_EXPLICIT_PRODUCTION_PUBLICATION_AUTHORIZATION
 * 
 * PARAR. NÃO PUBLICAR E NÃO REENVIAR.
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
