import { describe, expect, it } from "vitest";
import {
  BLOG_SEO_PERSISTENCE_READY,
  persistedBlogSeoSettings,
  withBlogSeoPersistenceSelect,
} from "./blog-seo-persistence-readiness";

const BASE = "id,title";

describe("blog SEO persistence readiness", () => {
  it("keeps the real persistence gate enabled after R4 validation", () => {
    expect(BLOG_SEO_PERSISTENCE_READY).toBe(true);
  });

  it("does not select persistence columns when readiness is explicitly disabled", () => {
    expect(withBlogSeoPersistenceSelect(BASE, false)).toBe(BASE);
  });

  it("adds the three canonical columns by default once persistence is ready", () => {
    expect(withBlogSeoPersistenceSelect(BASE)).toBe(
      "id,title,seo_allow_indexing,seo_allow_following,seo_include_in_sitemap",
    );
  });

  it("keeps historical defaults when compatibility mode is explicitly disabled", () => {
    expect(persistedBlogSeoSettings({
      seo_allow_indexing: false,
      seo_allow_following: false,
      seo_include_in_sitemap: false,
    }, false)).toEqual({
      allowIndexing: true,
      allowFollowing: true,
      includeInSitemap: true,
    });
  });

  it("maps persisted values by default and preserves noindex sitemap normalization", () => {
    expect(persistedBlogSeoSettings({
      seo_allow_indexing: false,
      seo_allow_following: false,
      seo_include_in_sitemap: true,
    })).toEqual({
      allowIndexing: false,
      allowFollowing: false,
      includeInSitemap: false,
    });
  });
});
