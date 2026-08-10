/**
 * PROTOCOLO: VEJAMAIS_STRIPE_PRODUCTION_DEPLOYMENT_ARTIFACT_RECONCILIATION
 *
 * A decisão de publicação permanece BLOQUEADA provisoriamente.
 * 
 * Executar diagnóstico STRICT READ-ONLY para reconciliar:
 * 
 * current_production_revision = e11260e1
 * candidate_revision = e11260e1
 * production_route_currently_exists = false
 * public_webhook_route_registered = true
 * changed_paths = somente src/lib/tests/billing.webhook_contract.test.ts
 * 
 * NÃO publicar.
 * NÃO alterar código, banco, Stripe ou secrets.
 * NÃO reenviar eventos.
 * 
 * 1. DISTINGUIR REPOSITÓRIO DE DEPLOYMENT
 * 
 * Informar separadamente:
 * 
 * - repository HEAD;
 * - candidate commit;
 * - deployment ID atualmente servido por vejamais.com.br;
 * - commit/revision realmente usado no deployment;
 * - data/hora do deployment;
 * - hash do artefato server atual;
 * - hash do artefato server candidato.
 * 
 * Não tratar repository HEAD como prova do deployment publicado.
 * 
 * 2. ROTA NO COMMIT
 * 
 * Confirmar:
 * 
 * - arquivo real da rota;
 * - caminho exato;
 * - arquivo rastreado no Git;
 * - blob/hash;
 * - commit que introduziu a rota;
 * - presença da rota no commit e11260e1;
 * - presença no routeTree.gen.ts;
 * - presença no bundle/manifest server candidato;
 * - ausência ou presença no bundle/manifest atualmente publicado.
 * 
 * 3. CAUSA DO 404
 * 
 * Determinar uma única causa:
 * 
 * A. deployment publicado usa commit anterior;
 * B. deployment usa e11260e1, mas artefato server está desatualizado;
 * C. routeTree não incluiu a rota no build publicado;
 * D. rota não é compatível com o runtime de produção;
 * E. domínio vejamais.com.br aponta para outro deployment;
 * F. rebuild/redeploy da mesma revisão é necessário;
 * G. evidência insuficiente.
 * 
 * 4. DIFF REAL DE PUBLICAÇÃO
 * 
 * Calcular o diff entre:
 * 
 * - artefato efetivamente servido em produção;
 * - artefato candidato que seria publicado.
 * 
 * Não comparar apenas Git HEAD com working tree.
 * 
 * Informar todos os arquivos e módulos funcionais que mudariam, inclusive arquivos já commitados mas ainda não implantados.
 * 
 * 5. MIGRAÇÕES
 * 
 * Reconciliar:
 * 
 * migration_count = 116
 * migration_names = apenas um nome
 * 
 * Informar:
 * 
 * - migrações totais históricas;
 * - migrações novas ainda não implantadas;
 * - migrações que seriam executadas na publicação;
 * - quantidade real de DDL/DML pendente.
 * 
 * 6. PROVA DO CANDIDATO
 * 
 * Sem publicar, confirmar no artefato candidato:
 * 
 * - /api/public/stripe-webhook registrado no server manifest;
 * - GET previsto 405;
 * - POST sem assinatura previsto 400;
 * - nenhuma dependência de autenticação;
 * - nenhuma dependência de preview hostname;
 * - secrets resolvidos no runtime de produção;
 * - checkout live desabilitado;
 * - homepage preservada.
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
