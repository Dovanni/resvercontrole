import { describe, expect, it } from "vitest";
import {
  BLOG_SEO_DB_COLUMNS,
  BLOG_SEO_RPC_ARGS,
  toBlogSeoDraftRpcArgs,
  toBlogSeoPersistenceValues,
} from "./blog-seo-persistence-contract";

describe("P.10-C6.SEO-IMPL-R1 persistence contract", () => {
  it("locks the future database column names", () => {
    expect(BLOG_SEO_DB_COLUMNS).toEqual({
      allowIndexing: "seo_allow_indexing",
      allowFollowing: "seo_allow_following",
      includeInSitemap: "seo_include_in_sitemap",
    });
  });

  it("locks the future draft RPC argument names", () => {
    expect(BLOG_SEO_RPC_ARGS).toEqual({
      allowIndexing: "p_seo_allow_indexing",
      allowFollowing: "p_seo_allow_following",
      includeInSitemap: "p_seo_include_in_sitemap",
    });
  });

  it("preserves the historical SEO defaults for existing posts", () => {
    expect(toBlogSeoPersistenceValues()).toEqual({
      seo_allow_indexing: true,
      seo_allow_following: true,
      seo_include_in_sitemap: true,
    });
  });

  it("normalizes noindex to sitemap=false before persistence", () => {
    expect(
      toBlogSeoPersistenceValues({
        allowIndexing: false,
        allowFollowing: true,
        includeInSitemap: true,
      }),
    ).toEqual({
      seo_allow_indexing: false,
      seo_allow_following: true,
      seo_include_in_sitemap: false,
    });
  });

  it("maps normalized settings to the exact future RPC arguments", () => {
    expect(
      toBlogSeoDraftRpcArgs({
        allowIndexing: true,
        allowFollowing: false,
        includeInSitemap: false,
      }),
    ).toEqual({
      p_seo_allow_indexing: true,
      p_seo_allow_following: false,
      p_seo_include_in_sitemap: false,
    });
  });
});
