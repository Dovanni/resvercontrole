import { describe, expect, it } from "vitest";
import { mapPublishedBlogPost } from "./blog.repository";

function publishedRow(content: unknown) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "artigo-publicado",
    title: "Artigo publicado",
    excerpt: "Resumo editorial",
    content,
    status: "published" as const,
    published_at: "2026-09-04T23:38:43Z",
    updated_at: "2026-09-04T23:38:43Z",
    reading_time_minutes: 5,
    meta_title: "Artigo publicado | VEJAMAIS ERP",
    meta_description: "Descrição do artigo publicado.",
    focus_keyword: "artigo publicado",
    featured_image_path: null,
    featured_image_alt: "Imagem do artigo publicado",
    blog_categories: { name: "Gestão Financeira" },
    blog_authors: { display_name: "Equipe Editorial VEJAMAIS ERP" },
    blog_post_tags: [],
  };
}

describe("Blog published content normalization", () => {
  it("groups canonical heading/paragraph blocks into public article sections", () => {
    const article = mapPublishedBlogPost(
      publishedRow([
        { type: "heading", level: 2, text: "Por que o fluxo de caixa merece atenção" },
        { type: "paragraph", text: "Primeiro parágrafo." },
        { type: "paragraph", text: "Segundo parágrafo." },
        { type: "heading", level: 2, text: "1. Separe o realizado do previsto" },
        { type: "paragraph", text: "Terceiro parágrafo." },
      ]),
    );

    expect(article.sections).toEqual([
      {
        heading: "Por que o fluxo de caixa merece atenção",
        paragraphs: ["Primeiro parágrafo.", "Segundo parágrafo."],
      },
      {
        heading: "1. Separe o realizado do previsto",
        paragraphs: ["Terceiro parágrafo."],
      },
    ]);
  });

  it("preserves compatibility with legacy heading/paragraphs sections", () => {
    const article = mapPublishedBlogPost(
      publishedRow([{ heading: "Seção legada", paragraphs: ["Parágrafo legado"] }]),
    );

    expect(article.sections).toEqual([{ heading: "Seção legada", paragraphs: ["Parágrafo legado"] }]);
  });

  it("ignores malformed or orphan blocks instead of emitting empty public sections", () => {
    const article = mapPublishedBlogPost(
      publishedRow([
        { type: "paragraph", text: "Parágrafo sem heading" },
        { type: "heading", level: 2, text: "Seção válida" },
        { type: "paragraph", text: "Conteúdo válido" },
        { type: "heading", level: 2, text: "Heading sem conteúdo" },
        null,
        "texto solto",
      ]),
    );

    expect(article.sections).toEqual([{ heading: "Seção válida", paragraphs: ["Conteúdo válido"] }]);
  });
});
