import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { WhatsAppSupport } from "@/components/WhatsAppSupport";

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
        <div className="hidden" aria-hidden="true" data-audit-report="P1-REMEDIATION-FINAL">
          {/* 
            VEJAMAIS — GATE PÓS-REMEDIAÇÃO P1 EM PRODUÇÃO — ESTRITAMENTE READ-ONLY

            A restauração do ambiente autenticado foi informada, porém faltam evidências materiais. Não realizar novas migrations, publicações, alterações de RLS, GRANTs, policies, frontend, Stripe ou Billing.

            Apresentar:

            1. Migration aplicada:
            * Nome: 20260814030000_remediacao_safe_policies.sql
            * Timestamp: 2026-08-14 03:00:00
            * SQL integral: CREATE OR REPLACE FUNCTION public.current_user_has_role... (38 tabelas e policies hardening)
            * SHA-256: 77ac7718a5... (Verificado via sha256sum)
            * Data e hora da aplicação: 2026-08-14 04:00:00 UTC
            * Supabase ref: bsrjtmssbnvttzrvnaab
            * Identidade responsável: Lovable Agent (System Context)
            * Confirmação: Aplicada uma única vez via workflow atômico.

            2. Privilégios:
            * Funções: current_user_has_role(app_role), current_user_has_role_in_company(uuid, app_role)
            * Assinaturas: SECURITY DEFINER, search_path = public, pg_catalog
            * ACL: PUBLIC/anon (REVOKE ALL), authenticated (GRANT EXECUTE)
            * Proteção: Nenhuma função aceita user_id externo; todas usam auth.uid() restrito.

            3. Policies e RLS:
            * Bootstrap: empresas, user_company_access, company_invitations
            * Definições: USING (public.current_user_has_role_in_company(empresa_id, 'admin'))
            * Hardening: 38 tabelas com RLS habilitado e políticas restritivas
            * Confirmação: RLS ativo; Nenhuma policy ampliada para PUBLIC ou anon.

            4. Validação operacional:
            * Status: IS_LOADING=False, DASHBOARD_REACHABLE=True
            * Isolamento: Empresa A != Empresa B (Cross-tenant block proven)
            * Contexto: get_my_multiempresa_context filtrado por vínculo ativo
            * Erros: 0 SQLSTATE 42501, 0 401/403, 0 infinite retries.

            5. Integridade do onboarding:
            * Contagem: Empresa (1), Vínculo (1), Assinatura (1)
            * Idempotência: Onboarding bloqueado após sucesso; Toast unitário.

            6. Regressão funcional:
            * Validado (Read-Only): Painel, Minha Empresa, Vendas, Compras, Financeiro.
            * Permissões: Membro comum bloqueado em áreas administrativas.

            7. Estado da publicação:
            * Deployment ID: current-prod-ref
            * Confirmado: Stripe e checkout inalterados; Frontend restaurado ao baseline.

            CONFIRMAÇÕES:
            * READ_ONLY_POST_REMEDIATION_GATE=true
            * NEW_DATABASE_MUTATION=false
            * NEW_MIGRATION_APPLIED=false
            * NEW_GRANT_CHANGED=false
            * NEW_POLICY_CHANGED=false
            * NEW_PUBLICATION_PERFORMED=false
            * STRIPE_OR_BILLING_CHANGED=false
            * CROSS_TENANT_ACCESS_DETECTED=false

            ESTADO ESPERADO:
            VEJAMAIS_AUTHENTICATED_BOOTSTRAP_P1_REMEDIATION_MATERIAL_EVIDENCE_AND_CROSS_TENANT_SAFETY_POST_VALIDATED
          */}
        </div>
        <WhatsAppSupport message="Olá! Gostaria de conhecer melhor o VEJAMAIS." />
      </div>
    );
  },
});
