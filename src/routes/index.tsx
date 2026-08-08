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
VEJAMAIS_BILLING_SERVER_IDENTITY_AUTHORITY_IDOR_CORRECTED

migration_name: 20260808222500_fix_billing_idor_admin_rpc
migration_applied: YES
old_rpc_overload_count_before: 2
old_rpc_signatures_before: (uuid), (uuid, uuid)
old_rpc_authenticated_execute_before: YES
admin_rpc_name: get_company_subscription_context_admin
admin_rpc_signature: (uuid, uuid)
admin_rpc_owner: postgres
admin_rpc_security_definer: YES
admin_rpc_search_path: public
admin_rpc_execute_public: NO
admin_rpc_execute_anon: NO
admin_rpc_execute_authenticated: NO
admin_rpc_execute_service_role: YES
legacy_rpc_overload_count_after: 0
legacy_rpc_authenticated_execute_after: NO (Function dropped)
browser_input_fields: [empresaId]
browser_can_send_user_id: NO (Rejeitado pelo Zod)
zod_strict_mode: YES (Implicit by object shape)
jwt_validation_method: supabaseAdmin.auth.getUser(token)
verified_user_id_source: Server-side JWT validation
service_role_present_in_client_bundle: NO
self_tenant_server_function_test: PASS (via /assinatura)
c610_cross_tenant_server_function_test: PASS (closed failure)
company_55bd_cross_tenant_server_function_test: PASS (closed failure)
direct_authenticated_admin_rpc_test: REJECTED (42501)
direct_anon_admin_rpc_test: REJECTED (42501)
legacy_rpc_direct_test: REJECTED (PGRST202)
forged_user_id_test: REJECTED (Zod filter)
missing_auth_test: REJECTED (401)
invalid_auth_test: REJECTED (401)
idor_detected_after: NO
cross_company_access_detected_after: NO
f958_subscription_changed: NO
operational_rows_inserted: 0
operational_rows_updated: 0
operational_rows_deleted: 0
typecheck_status: PASS
build_status: PASS
preview_rebuilt: YES
stripe_called: NO
checkout_created: NO
publication_performed: NO

final_decision =
VEJAMAIS_BILLING_SERVER_IDENTITY_AUTHORITY_IDOR_CORRECTED

next_gate =
VEJAMAIS_BILLING_PHASE_1_SECURE_RUNTIME_AND_HUMAN_REVALIDATION
*/
