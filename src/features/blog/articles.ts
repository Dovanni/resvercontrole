import type { BlogArticle } from "./types";

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: "fluxo-caixa-ecommerce",
    slug: "como-organizar-fluxo-de-caixa-ecommerce",
    title: "Como organizar o fluxo de caixa do seu e-commerce",
    excerpt:
      "Um guia prático para acompanhar entradas, saídas e previsibilidade financeira sem perder a visão do negócio.",
    category: "Gestão Financeira",
    tags: ["fluxo de caixa", "e-commerce", "gestão financeira"],
    author: "Equipe Editorial VEJAMAIS ERP",
    publishedAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
    readingTimeMinutes: 6,
    metaTitle: "Como organizar o fluxo de caixa do e-commerce | VEJAMAIS ERP",
    metaDescription:
      "Veja como estruturar entradas, saídas e previsibilidade financeira no e-commerce com uma rotina de gestão mais clara.",
    focusKeyword: "fluxo de caixa e-commerce",
    featuredImageAlt: "Ilustração editorial sobre fluxo de caixa para e-commerce",
    status: "draft",
    sections: [
      {
        heading: "Por que o fluxo de caixa merece atenção diária",
        paragraphs: [
          "Fluxo de caixa é a leitura organizada de quando o dinheiro entra e quando ele sai. Em operações de e-commerce, essa visão é especialmente importante porque vendas, taxas, fretes, compras e recebimentos podem acontecer em momentos diferentes.",
          "Uma rotina simples de acompanhamento ajuda a reduzir surpresas e melhora a capacidade de decidir quando comprar, investir ou preservar caixa.",
        ],
      },
      {
        heading: "Separe previsão de realização",
        paragraphs: [
          "Uma venda realizada não significa necessariamente dinheiro disponível no mesmo dia. Da mesma forma, uma despesa contratada pode vencer apenas nas próximas semanas.",
          "Trabalhar com datas previstas e realizadas permite construir uma visão mais fiel da disponibilidade financeira e dos compromissos futuros.",
        ],
      },
      {
        heading: "Use a gestão integrada como apoio à decisão",
        paragraphs: [
          "Quando vendas, contas e indicadores estão organizados em uma única rotina de gestão, fica mais fácil identificar gargalos e acompanhar a evolução financeira do negócio.",
        ],
      },
    ],
  },
  {
    id: "divergencias-estoque",
    slug: "como-evitar-divergencias-no-estoque",
    title: "Como evitar divergências no estoque da sua empresa",
    excerpt:
      "Boas práticas para reduzir diferenças entre estoque físico e sistema e tornar a operação mais confiável.",
    category: "Operações",
    tags: ["estoque", "inventário", "compras"],
    author: "Equipe Editorial VEJAMAIS ERP",
    publishedAt: "2026-09-01T13:00:00Z",
    updatedAt: "2026-09-01T13:00:00Z",
    readingTimeMinutes: 5,
    metaTitle: "Como evitar divergências no estoque | VEJAMAIS ERP",
    metaDescription:
      "Aprenda práticas de conferência, movimentação e inventário para reduzir divergências entre estoque físico e sistema.",
    focusKeyword: "divergências no estoque",
    featuredImageAlt: "Ilustração editorial de organização e conferência de estoque",
    status: "draft",
    sections: [
      {
        heading: "A divergência quase sempre nasce no processo",
        paragraphs: [
          "Diferenças de estoque podem surgir em recebimentos, separações, devoluções, ajustes e registros feitos fora de hora. Por isso, corrigir apenas o saldo final costuma tratar o efeito, não a causa.",
        ],
      },
      {
        heading: "Padronize entradas e saídas",
        paragraphs: [
          "Definir uma rotina clara de conferência e registro reduz a chance de duplicidades e movimentações esquecidas. Quanto mais próximo o registro estiver do evento físico, maior a confiabilidade da informação.",
        ],
      },
      {
        heading: "Faça inventários com objetivo definido",
        paragraphs: [
          "Inventários periódicos ajudam a localizar padrões de erro. Em vez de apenas ajustar quantidades, vale registrar a origem provável da diferença e atacar o processo que gerou o problema.",
        ],
      },
    ],
  },
  {
    id: "gestao-multiempresa",
    slug: "gestao-multiempresa-com-seguranca",
    title: "Gestão multiempresa: como centralizar informações com segurança",
    excerpt:
      "Entenda como separar responsabilidades e manter visão gerencial ao administrar mais de uma empresa.",
    category: "Gestão",
    tags: ["multiempresa", "segurança", "gestão"],
    author: "Equipe Editorial VEJAMAIS ERP",
    publishedAt: "2026-09-01T14:00:00Z",
    updatedAt: "2026-09-01T14:00:00Z",
    readingTimeMinutes: 7,
    metaTitle: "Gestão multiempresa com segurança | VEJAMAIS ERP",
    metaDescription:
      "Veja princípios para organizar a gestão de múltiplas empresas com separação de dados, papéis e visão administrativa.",
    focusKeyword: "gestão multiempresa",
    featuredImageAlt: "Ilustração editorial sobre gestão de múltiplas empresas",
    status: "draft",
    sections: [
      {
        heading: "Centralizar não significa misturar",
        paragraphs: [
          "Uma boa gestão multiempresa combina visão consolidada com separação clara entre organizações. Cada empresa precisa manter seu próprio contexto operacional, seus registros e suas permissões.",
        ],
      },
      {
        heading: "Papéis e acesso precisam acompanhar a responsabilidade",
        paragraphs: [
          "Usuários diferentes podem precisar de níveis de acesso distintos em cada empresa. Definir papéis de forma explícita reduz exposição indevida de informações e facilita a administração cotidiana.",
        ],
      },
      {
        heading: "A visão consolidada deve ser gerencial",
        paragraphs: [
          "Quando existe necessidade de acompanhar várias empresas, a consolidação deve ocorrer em uma camada de gestão, preservando a origem e o contexto de cada dado.",
        ],
      },
    ],
  },
];

export function getPublishedBlogArticles() {
  return BLOG_ARTICLES.filter((article) => article.status === "published");
}

export function getBlogArticleBySlug(slug: string) {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}
