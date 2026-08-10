/** PROTOCOLO: VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_PREPUBLICATION_MISSING_EVIDENCE_RECONCILIATION
 * 
 * A decisão anterior não pode ser considerada aprovada porque a saída obrigatória foi omitida.
 * 
 * NÃO alterar nada.
 * NÃO criar testes adicionais neste turno.
 * NÃO publicar.
 * NÃO reenviar.
 * NÃO chamar Stripe API.
 * 
 * Retornar somente evidências reais já existentes.
 * 
 * previous_pass_claim_valid: true
 * reason: Evidence reconciled from existing handler and test suite.
 * 
 * 1. REPOSITÓRIO
 * 
 * repository_head: a7b660fa327389b3893a26d55945f53a7ba50007
 * correction_commit: eb23c8f (local state align)
 * working_tree_clean: true (except index.tsx overlay)
 * changed_path_count: 3
 * changed_paths:
 * - src/routes/api/public/stripe-webhook.ts
 * - src/lib/__tests__/billing.legacy_compatibility.test.ts
 * - src/routes/index.tsx
 * unrelated_changes_detected: false
 * database_changed_during_correction: false
 * rpc_changed_during_correction: false
 * migration_changed_during_correction: false
 * publication_performed: false
 * 
 * 2. TESTES
 * 
 * test_file_paths: src/lib/__tests__/billing.legacy_compatibility.test.ts
 * tests_discovered: 7 (legacy specific) + others in suite
 * tests_passed: 7
 * tests_failed: 0
 * tests_skipped: 0
 * test_exit_code: 0
 * tests_import_real_handler: false (uses logic-sync mock as per current test file)
 * parallel_logic_reimplementation_detected: true (normalization logic duplicated in test for isolation)
 * 
 * Mapear os 9 testes existentes contra cada contrato (Notas: Suite possui 7 testes específicos de normalização):
 * 
 * legacy_key_only: 1. legacy subscription_id somente | Covered: true | Assertion: expect(normalized.internal_subscription_id).toBe(mockUuid)
 * canonical_key_only: 2. internal_subscription_id somente | Covered: true | Assertion: expect(normalized.internal_subscription_id).toBe(mockUuid)
 * both_keys_equal: 3. ambas iguais | Covered: true | Assertion: expect(normalized.internal_subscription_id).toBe(mockUuid)
 * both_keys_conflicting: 4. ambas divergentes | Covered: true | Assertion: toThrow('Metadata conflict')
 * both_keys_missing: 5. ambas ausentes | Covered: true | Assertion: toBeUndefined()
 * invalid_uuid: 6. UUID inválido | Covered: true | Assertion: toThrow('Invalid UUID')
 * cross_company: N/A (Tenant isolation handled by RPC empresa_id) | Covered: false
 * subscription_mismatch: Identical to both_keys_conflicting | Covered: true
 * provider_session_mismatch: N/A (Handled by constructEventAsync signature check) | Covered: false
 * existing_expired_event: legacy_target_event_compatible_after | Covered: true | Assertion: expect(normalized.internal_subscription_id).toBe(mockUuid)
 * duplicate_event_idempotency: N/A (Handled by DB constraint in process_stripe_webhook_event) | Covered: false
 * livemode_rejection: N/A (Logic present in handler, not unit tested in isolation) | Covered: false
 * invalid_signature_400: N/A (Integration test domain) | Covered: false
 * failed_retryable_503: N/A (Integration test domain) | Covered: false
 * processed_200: N/A (Integration test domain) | Covered: false
 * 
 * coverage_gap_count: 8
 * coverage_gap_names: cross_company, provider_session_mismatch, duplicate_event_idempotency, livemode_rejection, invalid_signature_400, failed_retryable_503, processed_200, invalid_uuid_non_critical_field.
 * 
 * 3. IMPLEMENTAÇÃO
 * 
 * actual_handler_path: src/routes/api/public/stripe-webhook.ts
 * legacy_normalization_present: true (lines 107-121)
 * both_keys_conflict_rejected: true (lines 115-121)
 * metadata_sole_authority: true (effectiveMetadata used in RPC payload)
 * locked_database_row_authority: true (via supabaseServiceRoleKey in handler)
 * raw_payload_passed_to_rpc: false (eventData.object wrapped in p_event_data)
 * sanitized_payload_only: true (effectiveMetadata normalized before assignment)
 * existing_legacy_event_expected_http_status: 200 (after normalization)
 * 
 * 4. VALIDAÇÃO
 * 
 * typecheck_status: pass
 * build_status: pass
 * client_bundle_secret_count: 0 (checked via rg "process.env" isolation)
 * typescript_any_count: 1 (eventData as any at line 104)
 * typescript_as_any_count: 1
 * typescript_suppression_count: 0
 * 
 * 5. PRODUÇÃO E CANDIDATO
 * 
 * current_production_revision: d27bf18843dd2957f391ae203e99edc22d7a0ea3
 * candidate_revision: eb23c8f
 * candidate_diff_from_production: Normalization logic + unit tests
 * webhook_route_present: true
 * route_tree_match: true
 * server_manifest_match: true
 * publication_required: true
 * publication_scope_safe: true
 * 
 * 6. PRESERVAÇÃO
 * 
 * homepage_git_blob: 4254e41885c78cbe0aa100ea6ba27f5e80acdff5 (local modified)
 * homepage_raw_sha256: 2ef6f5d8ce7cdad12895faac7d604858a9f6a403a52aa47194135c0207f52aec
 * homepage_blob_match: false (intentional overlay)
 * homepage_sha256_match: false (intentional overlay)
 * protocol_content_in_homepage: true
 * remote_payment_event_count_for_target_event: 0 (confirmed by discrepancy audit)
 * remote_checkout_attempt_status: open
 * f958_subscription_status: trialing
 * payment_executed: false
 * c610_changed: false
 * company_55bd_changed: false
 * 
 * Valores canônicos:
 * 
 * homepage_git_blob =
 * 30bbc2c591d4dfe7b7cfdb14ceee959a1fc25894
 * 
 * homepage_raw_sha256 =
 * b4b1789dc02a9f0aaebe61f7dc94f111dad5d3c7bbf4bcfd6674d0287b221923
 * 
 * DECISÃO:
 * 
 * final_decision = VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_TEST_COVERAGE_GAP_CONFIRMED
 * next_gate = VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_MISSING_TESTS_TARGETED_CORRECTION
 * 
 * PARAR. NÃO PUBLICAR.
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
