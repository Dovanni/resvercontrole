import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vejamais — Gestão Comercial e Financeira para o seu negócio" },
      { name: "description", content: "Controle financeiro, comercial e e-commerce em uma única plataforma. Do pedido ao lucro com clareza e rentabilidade." },
      { property: "og:title", content: "Vejamais — Gestão Comercial e Financeira" },
      { property: "og:description", content: "Plataforma completa para gestão de e-commerce e comércio em geral." },
      { name: "twitter:card", content: "summary_large_image" }
    ],
  }),
  component: LandingPage,
});
