import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vejamais | Gestão Comercial e Financeira" },
      {
        name: "description",
        content:
          "Centralize vendas, produtos, clientes, fornecedores, contas, fluxo de caixa e resultados com o Vejamais.",
      },
      { property: "og:title", content: "Vejamais | Gestão Comercial e Financeira" },
      {
        property: "og:description",
        content:
          "Plataforma de gestão comercial e financeira para acompanhar vendas, compras, contas, fluxo de caixa e indicadores do seu negócio.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://vejamais.com.br/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Vejamais | Gestão Comercial e Financeira" },
      {
        name: "twitter:description",
        content:
          "Vendas, compras, contas, fluxo de caixa e indicadores em uma única plataforma.",
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
            "Plataforma de gestão comercial e financeira para pequenos e médios negócios.",
        }),
      },
    ],
  }),
  component: LandingPage,
});
