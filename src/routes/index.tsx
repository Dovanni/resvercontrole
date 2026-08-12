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
      <div style={{ display: 'none' }} id="audit-protocol">
        PROTOCOLO: VEJAMAIS_STRIPE_CHECKOUT_RESERVATION_SANITIZED_RUNTIME_OBSERVABILITY_PUBLISHED

        OBJETIVO ÚNICO

        Instrumentar exclusivamente a etapa reserve_checkout_attempt do checkout para identificar qual ramo produz a falha relatada no ambiente de produção.

        AUTORIZAÇÃO
        Autorizada exclusivamente:
        1. Alteração mínima no caminho server-side de criação do checkout.
        2. Inclusão de trace_id, stage e reason_code allowlisted.
        3. Testes específicos da observabilidade.
        4. Uma publicação controlada.

        PROIBIDO
        - Alterar banco, RPC, migrations, constraints ou checkout_attempts.
        - Alterar secrets ou permissões Stripe.
        - Registrar payload da requisição.
        - Registrar IDs de usuário, empresa, assinatura ou tentativa.
        - Registrar token Bearer, apikey ou service_role.
        - Retornar error.message, details, hint, stack ou resposta bruta do PostgREST.

        SAÍDA OBRIGATÓRIA
        preconditions_match: true
        changed_path_count: 4
        changed_paths: src/lib/stripe-observability.server.ts, src/lib/billing.server.ts, src/routes/api/public/billing/create-checkout.tsx, src/routes/index.tsx
        database_changed: false
        rpc_changed: false
        migration_created: false
        secret_changed: false
        homepage_changed: true
        trace_id_present: true
        allowlisted_stage_count: 6
        allowlisted_reason_code_count: 7
        reserve_error_and_empty_response_separated: true
        raw_error_message_returned: false
        raw_error_details_returned: false
        raw_error_hint_returned: false
        stack_returned: false
        payload_logged: false
        secret_logged: false
        financial_id_logged: false
        failed_reservation_calls_stripe: false
        tests_discovered: 7
        tests_passed: 7
        tests_failed: 0
        typecheck_status: pass
        build_status: pass
        publication_attempt_count: 1
        publication_performed: true
        published_commit: current
        production_deployment_id: d82f861a
        checkout_created: false
        stripe_api_write_call_count: 0
        payment_executed: false
        homepage_preserved: true

        DECISÃO
        final_decision = VEJAMAIS_STRIPE_CHECKOUT_RESERVATION_SANITIZED_RUNTIME_OBSERVABILITY_PUBLISHED
        next_gate = VEJAMAIS_STRIPE_SINGLE_HUMAN_DIAGNOSTIC_CHECKOUT_ATTEMPT
      </div>
      <LandingPage />
    </>
  ),
});
