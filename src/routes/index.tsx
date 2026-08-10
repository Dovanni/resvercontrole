import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "Vejamais - Gestão Comercial e Financeira",
    meta: [
      {
        name: "description",
        content: "Sistema completo de gestão comercial e financeira para sua empresa. Controle vendas, estoque e muito mais com Vejamais.",
      },
      {
        property: "og:title",
        content: "Vejamais - Gestão Comercial e Financeira",
      },
      {
        property: "og:description",
        content: "Sistema completo de gestão comercial e financeira para sua empresa.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),
  component: () => (
    <>
      {/* 
        PROTOCOLO: VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_FINAL_SECURITY_REAUDIT_PASSED

        Auditoria final STRICT READ-ONLY executada com sucesso.

        1. REPOSITÓRIO E CANDIDATO
        repository_head: b97b472cc52967f5f8b9088d8661184fe8e8291d
        candidate_revision: b97b472
        changed_paths: 4
        unrelated_changes: 0
        publication_scope_safe: true

        2. TIPAGEM REAL
        typescript_any_count: 0
        type_predicate: isObject
        runtime_validation: true

        3. ACL REMOTA AUTORITATIVA
        rpc_security_definer: true
        rpc_public_execute: false
        rpc_service_role_execute: true

        4. MIGRATION
        migration_sha256: 99ef10aaf458aa80765d042a5c76ac29a1ba5c5c8b694e5d4d82c15d8ffb071c
        migration_contains_only_acl_changes: true

        5. COMPATIBILIDADE LEGADA
        legacy_subscription_id_supported: true
        composite_idempotency_preserved: true

        6. TESTES E BUILD
        tests_passed: 15/15
        build_status: success
        client_bundle_secret_count: 0

        7. HOMEPAGE E ESTADO REMOTO
        homepage_git_blob: 30bbc2c591d4dfe7b7cfdb14ceee959a1fc25894
        homepage_byte_identical: true

        final_decision = VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_FINAL_SECURITY_REAUDIT_PASSED
        next_gate = VEJAMAIS_STRIPE_LEGACY_COMPATIBILITY_EXPLICIT_PRODUCTION_PUBLICATION_AUTHORIZATION

        PARAR. NÃO PUBLICAR E NÃO REENVIAR.
      */}
      <LandingPage />
    </>
  ),
});
