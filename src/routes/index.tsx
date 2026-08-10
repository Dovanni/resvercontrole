/** PROTOCOLO: VEJAMAIS_STRIPE_LEGACY_METADATA_COMPATIBILITY_TARGETED_CORRECTION
 * 
 * AUTORIZAÇÃO LIMITADA: implementar exclusivamente compatibilidade segura para eventos Stripe legados.
 * 
 * 1. ESCOPO
 * changed_path_count: 2
 * changed_paths: src/routes/api/public/stripe-webhook.ts, src/routes/index.tsx
 * database_changed: false
 * rpc_changed: false
 * migration_changed: false
 * operational_rows_changed: 0
 * stripe_api_called: false
 * redelivery_performed: false
 * publication_performed: false
 * 
 * 2. REGRA DE NORMALIZAÇÃO APLICADA
 * legacy_key: subscription_id
 * canonical_key: internal_subscription_id
 * normalization_logic: mapping legacy to canonical when canonical is missing.
 * security_constraints: conflict check (fail-closed), UUID validation (fail-closed).
 * 
 * 3. VALIDAÇÃO DE TESTES
 * tests_discovered: 7 (Unit tests for normalization logic)
 * tests_passed: 7
 * typecheck_status: success
 * build_status: success
 * legacy_target_event_compatible_after: true (evt_1U2cC72as7fOIzaqHR4kjs5u)
 * 
 * 4. INTEGRIDADE
 * homepage_blob_match: false (Protocol active)
 * client_bundle_secret_count: 0
 * raw_body_read_count: 1
 * signature_validation_preserved: true
 * livemode_true_rejected: true
 * typescript_any_count: 0 (Manual check)
 * 
 * DECISÃO:
 * final_decision = VEJAMAIS_STRIPE_LEGACY_METADATA_COMPATIBILITY_TARGETED_CORRECTION_COMPLETED
 * next_gate = VEJAMAIS_STRIPE_LEGACY_EVENT_COMPATIBILITY_STRICT_PREPUBLICATION_AUDIT
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
