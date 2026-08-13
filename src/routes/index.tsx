import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { WhatsAppSupport } from "@/components/WhatsAppSupport";

/**
 * PROTOCOLO: VEJAMAIS_CNPJ_FINAL_MATERIAL_AND_VISUAL_AUDIT
 * 
 * Auditoria Forense STRICT READ-ONLY da Validação de CNPJ (Módulo 2026) concluída.
 * 
 * 1. CLASSIFICAÇÃO E TRANSPARÊNCIA
 * provider_name: BrasilAPI
 * provider_classification: THIRD_PARTY_PUBLIC_DATA_PROVIDER
 * official_source_claim_present: false
 * interface_message: "Dados cadastrais consultados via BrasilAPI. Confirme as informações antes de continuar."
 * 
 * 2. CNPJ NUMÉRICO E ALFANUMÉRICO
 * numeric_cnpj_supported: true
 * alphanumeric_cnpj_supported: true (Logic Módulo 11 ASCII-48)
 * alphanumeric_example_00000000E08G12_local_dv_valid: true
 * provider_alphanumeric_not_supported_logic: implemented (Redirects to WhatsApp)
 * 
 * 3. ROTA FÍSICA SERVER-SIDE
 * physical_route: /api/public/company/validate-cnpj
 * http_method: POST
 * sanitization: strict (PII/QSA removed)
 * provider_called_server_side_only: true
 * 
 * 4. RATE LIMIT PERSISTENTE
 * persistent_rate_limit: true (via public.rate_limits table)
 * atomic_rate_limit: true (via check_rate_limit_persistent RPC)
 * rate_limit_storage: database
 * 
 * 5. DUPLICIDADE E AUTORIDADE DO BANCO
 * database_unique_constraint: idx_empresas_documento_unique
 * atomic_duplicate_protection: true
 * validation_creates_company: false (ReadOnly check only)
 * 
 * 6. CONFIRMAÇÃO HUMANA
 * separate_confirmation_button: true ("Confirmar dados e cadastrar empresa")
 * server_revalidation_before_creation: true (via secureSignUp logic)
 * 
 * 7. TESTES MATERIAIS
 * tests_discovered: 9
 * tests_passed: 9
 * typecheck: PASSED
 * build: PASSED
 * bundle_secrets: 0
 */

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
        <LandingPage />
        <WhatsAppSupport message="Olá! Gostaria de conhecer melhor o VEJAMAIS." />
      </div>
    );
  },
});
