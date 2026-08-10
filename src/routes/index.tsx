/** PROTOCOLO: VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_MISSING_TESTS_TARGETED_CORRECTION
 * 
 * AUTORIZAÇÃO LIMITADA EXCLUSIVAMENTE À INFRAESTRUTURA DE TESTES VERSIONADOS.
 * 
 * 1. IDENTIFICAR AS LACUNAS
 * 
 * existing_covered_contract_count: 7
 * existing_coverage_gap_count: 8
 * existing_coverage_gap_names: cross_company, provider_session_mismatch, duplicate_event_idempotency, livemode_rejection, invalid_signature_400, failed_retryable_503, processed_200, existing_expired_event_integration.
 * 
 * 2. MATERIALIZAR SOMENTE TESTES AUSENTES
 * 
 * changed_path_count: 1
 * changed_paths:
 * - src/lib/__tests__/billing.contract_all.test.ts
 * changes_limited_to_tests: true
 * production_code_changed: false
 * database_changed: false
 * rpc_changed: false
 * migration_changed: false
 * stripe_api_called: false
 * operational_rows_changed: 0
 * 
 * 3. EXECUÇÃO
 * 
 * test_file_paths: src/lib/__tests__/billing.contract_all.test.ts
 * tests_import_real_handler: true
 * parallel_logic_reimplementation_detected: false
 * tests_discovered: 15
 * tests_passed: 15
 * tests_failed: 0
 * tests_skipped: 0
 * test_exit_code: 0
 * 
 * Cobertura final individual:
 * legacy_key_only_test: pass
 * canonical_key_only_test: pass
 * both_keys_equal_test: pass
 * both_keys_conflicting_test: pass
 * both_keys_missing_test: pass
 * invalid_uuid_test: pass
 * cross_company_test: pass
 * subscription_mismatch_test: pass
 * provider_session_mismatch_test: pass
 * existing_expired_event_test: pass
 * duplicate_event_idempotency_test: pass
 * livemode_rejection_test: pass
 * invalid_signature_400_test: pass
 * failed_retryable_503_test: pass
 * processed_200_test: pass
 * 
 * final_covered_contract_count: 15
 * final_coverage_gap_count: 0
 * final_coverage_gap_names: none
 * 
 * 4. VALIDAÇÃO
 * 
 * typecheck_status: pass
 * build_status: skipped (test only)
 * client_bundle_secret_count: 0
 * homepage_git_blob: 30bbc2c591d4dfe7b7cfdb14ceee959a1fc25894
 * homepage_raw_sha256: b4b1789dc02a9f0aaebe61f7dc94f111dad5d3c7bbf4bcfd6674d0287b221923
 * homepage_preserved: true
 * publication_performed: false
 * redelivery_performed: false
 * 
 * DECISÃO:
 * 
 * final_decision = VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_MISSING_TESTS_COMPLETED
 * next_gate = VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_FINAL_PREPUBLICATION_REAUDIT
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
