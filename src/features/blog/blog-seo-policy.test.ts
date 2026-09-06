import { describe, expect, it } from "vitest";
import { buildBlogSitemapXml, buildPublishedArticleHead } from "./blog-seo";
import { buildBlogRobotsContent, resolveBlogSeoSettings, shouldIncludeArticleInSitemap } from "./blog-seo-policy";
import type { BlogArticle } from "./types";

function article(overrides: Partial<BlogArticle> = {}): BlogArticle {
  return {
    id: "seo-r0",
    slug: "seo-r0",
    title: "SEO R0",
    excerpt: "Resumo",
    category: "Gestão Empresarial",
    tags: ["seo"],
    author: "Equipe Editorial VEJAMAIS ERP",
    publishedAt: "2026-09-06T12:00:00Z",
    updatedAt: "2026-09-06T12:30:00Z",
    readingTimeMinutes: 3,
    metaTitle: "SEO R0 | VEJAMAIS ERP",
    metaDescription: "Descrição SEO R0",
    focusKeyword: "seo r0",
    featuredImageAlt: "Imagem SEO R0",
    status: "published",
    sections: [{ heading: "Seção", paragraphs: ["Conteúdo"] }],
    ...overrides,
  };
}

describe("P.10-C6.SEO-IMPL-R0 policy", () => {
  it("preserves legacy defaults when persistence flags are absent", () => {
    expect(resolveBlogSeoSettings()).toEqual({
      allowIndexing: true,
      allowFollowing: true,
      includeInSitemap: true,
    });
    expect(buildBlogRobotsContent(article())).toBe("index, follow, max-image-preview:large");
  });

  it("supports index + nofollow", () => {
    expect(buildBlogRobotsContent(article({ seo: { allowFollowing: false } }))).toBe(
      "index, nofollow, max-image-preview:large",
    );
  });

  it("supports noindex and automatically excludes the article from sitemap", () => {
    const noindex = article({
      seo: { allowIndexing: false, allowFollowing: true, includeInSitemap: true },
    });

    expect(buildBlogRobotsContent(noindex)).toBe("noindex, follow");
    expect(shouldIncludeArticleInSitemap(noindex)).toBe(false);
    expect(buildBlogSitemapXml([noindex])).not.toContain("/blog/seo-r0");
  });

  it("allows an indexed article to be deliberately omitted from sitemap", () => {
    const hiddenFromSitemap = article({
      seo: { allowIndexing: true, allowFollowing: true, includeInSitemap: false },
    });

    expect(shouldIncludeArticleInSitemap(hiddenFromSitemap)).toBe(false);
    expect(buildBlogSitemapXml([hiddenFromSitemap])).not.toContain("/blog/seo-r0");
  });

  it("keeps canonical generation independent from robots visibility", () => {
    const noindex = article({ seo: { allowIndexing: false, allowFollowing: false } });
    const head = buildPublishedArticleHead(noindex);

    expect(head.meta).toContainEqual({ name: "robots", content: "noindex, nofollow" });
    expect(head.links).toContainEqual({ rel: "canonical", href: "https://vejamais.com.br/blog/seo-r0" });
  });
});
