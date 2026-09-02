import { describe, expect, it } from "vitest";
import {
  BLOG_SITEMAP_URL,
  buildBlogPostingJsonLd,
  buildBlogRobotsTxtProposal,
  buildBlogSitemapXml,
  blogCanonicalUrl,
} from "./blog-seo";
import type { BlogArticle } from "./types";

const article: BlogArticle = {
  id: "post-1", slug: "fluxo-de-caixa", title: "Fluxo de caixa", excerpt: "Guia prático.", category: "Financeiro",
  tags: ["financeiro", "erp"], author: "Equipe Editorial VEJAMAIS ERP", publishedAt: "2026-09-03T12:00:00.000Z",
  updatedAt: "2026-09-03T12:30:00.000Z", readingTimeMinutes: 6, metaTitle: "Fluxo de caixa | VEJAMAIS ERP",
  metaDescription: "Aprenda a organizar o fluxo de caixa.", focusKeyword: "fluxo de caixa", featuredImageAlt: "Fluxo de caixa",
  featuredImage: "https://example.supabase.co/storage/v1/object/public/blog-media/fluxo.webp", status: "published",
  sections: [{ heading: "Organização", paragraphs: ["Conteúdo"] }],
};

describe("Blog public SEO contracts", () => {
  it("builds canonical URLs under the public blog path", () => {
    expect(blogCanonicalUrl()).toBe("https://vejamais.com.br/blog");
    expect(blogCanonicalUrl("fluxo-de-caixa")).toBe("https://vejamais.com.br/blog/fluxo-de-caixa");
  });

  it("emits BlogPosting metadata from a published article", () => {
    const jsonLd = buildBlogPostingJsonLd(article);
    expect(jsonLd["@type"]).toBe("BlogPosting");
    expect(jsonLd.datePublished).toBe(article.publishedAt);
    expect(jsonLd.url).toBe(blogCanonicalUrl(article.slug));
    expect(jsonLd.image).toEqual([article.featuredImage]);
  });

  it("includes only the supplied published read model in sitemap output", () => {
    const xml = buildBlogSitemapXml([article]);
    expect(xml).toContain("https://vejamais.com.br/blog/fluxo-de-caixa");
    expect(xml).not.toContain("draft");
  });

  it("keeps an empty editorial sitemap valid before the first publication", () => {
    const xml = buildBlogSitemapXml([]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("<loc>https://vejamais.com.br/blog</loc>");
    expect(xml).not.toContain("/blog/fluxo-de-caixa");
  });

  it("adds the isolated sitemap to a robots proposal without replacing legacy directives", () => {
    const existing = "User-agent: *\nDisallow: /legacy-private/\nSitemap: https://vejamais.com.br/sitemap.xml\n";
    const proposed = buildBlogRobotsTxtProposal(existing);
    expect(proposed).toContain("Disallow: /legacy-private/");
    expect(proposed).toContain("Sitemap: https://vejamais.com.br/sitemap.xml");
    expect(proposed).toContain(`Sitemap: ${BLOG_SITEMAP_URL}`);
  });

  it("does not duplicate the blog sitemap directive", () => {
    const existing = `User-agent: *\nSitemap: ${BLOG_SITEMAP_URL}\n`;
    expect(buildBlogRobotsTxtProposal(existing).match(/sitemap-blog\.xml/g)).toHaveLength(1);
  });
});
