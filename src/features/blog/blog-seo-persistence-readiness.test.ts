import { describe, expect, it } from "vitest";
import {
  BLOG_SEO_PERSISTENCE_READY,
  persistedBlogSeoSettings,
  withBlogSeoPersistenceSelect,
} from "./blog-seo-persistence-readiness";

const BASE = "id,title";

describe("blog SEO persistence readiness", () => {
  it("keeps the real persistence gate disabled during repository-only R3", () => {
    expect(BLOG_SEO_PERSISTENCE_READY).toBe(false);
  });

  it("does not select future columns while the gate is disabled", () => {
    expect(withBlogSeoPersistenceSelect(BASE, false)).toBe(BASE);
  });

  it("adds the three canonical columns once persistence is explicitly ready", () => {
    expect(withBlogSeoPersistenceSelect(BASE, true)).toBe(
      "id,title,seo_allow_indexing,seo_allow_following,seo_include_in_sitemap",
    );
  });

  it("keeps historical defaults while persistence is not ready", () => {
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

  it("maps persisted values and preserves noindex sitemap normalization when ready", () => {
    expect(persistedBlogSeoSettings({
      seo_allow_indexing: false,
      seo_allow_following: false,
      seo_include_in_sitemap: true,
    }, true)).toEqual({
      allowIndexing: false,
      allowFollowing: false,
      includeInSitemap: false,
    });
  });
});
