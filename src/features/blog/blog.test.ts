import { describe, expect, it } from "vitest";
import { BLOG_ARTICLES } from "./articles";
import {
  getPreviewBlogArticleBySlug,
  getRelatedPreviewBlogArticles,
  listPreviewBlogArticles,
  mapPublishedBlogPost,
} from "./blog.repository";

describe("Blog Editorial V2 repository-only contracts", () => {
  it("keeps the initial preview content local and available through the repository", () => {
    expect(BLOG_ARTICLES).toHaveLength(3);
    expect(listPreviewBlogArticles()).toBe(BLOG_ARTICLES);
  });

  it("uses unique, non-empty slugs", () => {
    const slugs = listPreviewBlogArticles().map((article) => article.slug);

    expect(slugs.every((slug) => slug.trim().length > 0)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps every preview article out of published state", () => {
    expect(listPreviewBlogArticles().every((article) => article.status !== "published")).toBe(true);
  });

  it("resolves an article by its canonical slug through the repository", () => {
    const article = listPreviewBlogArticles()[0];

    expect(getPreviewBlogArticleBySlug(article.slug)?.id).toBe(article.id);
  });

  it("returns undefined for an unknown preview slug", () => {
    expect(getPreviewBlogArticleBySlug("artigo-inexistente")).toBeUndefined();
  });

  it("keeps related preview articles isolated from the current article", () => {
    const article = listPreviewBlogArticles()[0];
    const related = getRelatedPreviewBlogArticles(article);

    expect(related).toHaveLength(2);
    expect(related.every((candidate) => candidate.slug !== article.slug)).toBe(true);
  });

  it("has complete editorial SEO metadata", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(article.metaTitle.trim().length).toBeGreaterThan(0);
      expect(article.metaDescription.trim().length).toBeGreaterThan(0);
      expect(article.focusKeyword.trim().length).toBeGreaterThan(0);
      expect(article.featuredImageAlt.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps metadata within practical preview limits", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(article.metaTitle.length).toBeLessThanOrEqual(65);
      expect(article.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it("uses valid preview dates and positive reading times", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(Number.isNaN(Date.parse(article.publishedAt))).toBe(false);
      expect(Number.isNaN(Date.parse(article.updatedAt))).toBe(false);
      expect(article.readingTimeMinutes).toBeGreaterThan(0);
    }
  });

  it("has structured sections, categories and tags for every preview article", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(article.category.trim().length).toBeGreaterThan(0);
      expect(article.tags.length).toBeGreaterThan(0);
      expect(article.sections.length).toBeGreaterThan(0);
      expect(article.sections.every((section) => section.heading.trim().length > 0)).toBe(true);
      expect(article.sections.every((section) => section.paragraphs.length > 0)).toBe(true);
    }
  });

  it("maps a published database row to the homologated BlogArticle contract", () => {
    const article = mapPublishedBlogPost({
      id: "11111111-1111-4111-8111-111111111111",
      slug: "artigo-publicado",
      title: "Artigo publicado",
      excerpt: "Resumo editorial",
      content: [{ heading: "Seção", paragraphs: ["Parágrafo"] }],
      status: "published",
      published_at: "2026-09-02T12:00:00Z",
      updated_at: "2026-09-02T13:00:00Z",
      reading_time_minutes: 4,
      meta_title: "Artigo publicado | VEJAMAIS ERP",
      meta_description: "Descrição do artigo publicado.",
      focus_keyword: "artigo publicado",
      featured_image_path: null,
      featured_image_alt: "Imagem do artigo publicado",
      blog_categories: { name: "Gestão Empresarial" },
      blog_authors: { display_name: "Equipe Editorial VEJAMAIS ERP" },
      blog_post_tags: [{ blog_tags: { name: "gestão" } }],
    });

    expect(article.status).toBe("published");
    expect(article.category).toBe("Gestão Empresarial");
    expect(article.author).toBe("Equipe Editorial VEJAMAIS ERP");
    expect(article.tags).toEqual(["gestão"]);
    expect(article.sections).toEqual([{ heading: "Seção", paragraphs: ["Parágrafo"] }]);
  });

  it("rejects non-published rows in the public database mapper", () => {
    expect(() =>
      mapPublishedBlogPost({
        id: "22222222-2222-4222-8222-222222222222",
        slug: "draft",
        title: "Draft",
        excerpt: "Resumo",
        content: [],
        status: "draft",
        published_at: null,
        updated_at: "2026-09-02T13:00:00Z",
        reading_time_minutes: 1,
        meta_title: null,
        meta_description: null,
        focus_keyword: null,
        featured_image_path: null,
        featured_image_alt: null,
      }),
    ).toThrow("BLOG_REPOSITORY_EXPECTED_PUBLISHED_POST");
  });
});
