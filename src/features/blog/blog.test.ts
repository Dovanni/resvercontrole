import { describe, expect, it } from "vitest";
import { BLOG_ARTICLES, getBlogArticleBySlug, getPublishedBlogArticles } from "./articles";

describe("Blog Editorial V2 repository-only contracts", () => {
  it("keeps the initial preview content local and available", () => {
    expect(BLOG_ARTICLES).toHaveLength(3);
  });

  it("uses unique, non-empty slugs", () => {
    const slugs = BLOG_ARTICLES.map((article) => article.slug);

    expect(slugs.every((slug) => slug.trim().length > 0)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps every preview article out of published state", () => {
    expect(BLOG_ARTICLES.every((article) => article.status !== "published")).toBe(true);
    expect(getPublishedBlogArticles()).toEqual([]);
  });

  it("resolves an article by its canonical slug", () => {
    const article = BLOG_ARTICLES[0];

    expect(getBlogArticleBySlug(article.slug)?.id).toBe(article.id);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getBlogArticleBySlug("artigo-inexistente")).toBeUndefined();
  });

  it("has complete editorial SEO metadata", () => {
    for (const article of BLOG_ARTICLES) {
      expect(article.metaTitle.trim().length).toBeGreaterThan(0);
      expect(article.metaDescription.trim().length).toBeGreaterThan(0);
      expect(article.focusKeyword.trim().length).toBeGreaterThan(0);
      expect(article.featuredImageAlt.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps metadata within practical preview limits", () => {
    for (const article of BLOG_ARTICLES) {
      expect(article.metaTitle.length).toBeLessThanOrEqual(65);
      expect(article.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it("uses valid publication dates and positive reading times", () => {
    for (const article of BLOG_ARTICLES) {
      expect(Number.isNaN(Date.parse(article.publishedAt))).toBe(false);
      expect(Number.isNaN(Date.parse(article.updatedAt))).toBe(false);
      expect(article.readingTimeMinutes).toBeGreaterThan(0);
    }
  });

  it("has structured sections, categories and tags for every article", () => {
    for (const article of BLOG_ARTICLES) {
      expect(article.category.trim().length).toBeGreaterThan(0);
      expect(article.tags.length).toBeGreaterThan(0);
      expect(article.sections.length).toBeGreaterThan(0);
      expect(article.sections.every((section) => section.heading.trim().length > 0)).toBe(true);
      expect(article.sections.every((section) => section.paragraphs.length > 0)).toBe(true);
    }
  });
});
