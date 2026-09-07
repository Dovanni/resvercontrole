import { resolveBlogSeoSettings } from "./blog-seo-policy";
import type { BlogSeoSettings } from "./types";

/**
 * P.10-C6.SEO-IMPL-R1 — repository-only persistence contract.
 *
 * This module defines the exact database/RPC names expected by the future
 * Supabase migration. It performs no I/O and must remain safe to import before
 * the schema change exists.
 */
export const BLOG_SEO_DB_COLUMNS = {
  allowIndexing: "seo_allow_indexing",
  allowFollowing: "seo_allow_following",
  includeInSitemap: "seo_include_in_sitemap",
} as const;

export const BLOG_SEO_RPC_ARGS = {
  allowIndexing: "p_seo_allow_indexing",
  allowFollowing: "p_seo_allow_following",
  includeInSitemap: "p_seo_include_in_sitemap",
} as const;

export interface BlogSeoPersistenceValues {
  seo_allow_indexing: boolean;
  seo_allow_following: boolean;
  seo_include_in_sitemap: boolean;
}

export interface BlogSeoDraftRpcArgs {
  p_seo_allow_indexing: boolean;
  p_seo_allow_following: boolean;
  p_seo_include_in_sitemap: boolean;
}

/**
 * Normalizes editor values before persistence. A noindex article can never be
 * persisted as included in the editorial sitemap.
 */
export function toBlogSeoPersistenceValues(settings?: BlogSeoSettings): BlogSeoPersistenceValues {
  const resolved = resolveBlogSeoSettings(settings);
  return {
    seo_allow_indexing: resolved.allowIndexing,
    seo_allow_following: resolved.allowFollowing,
    seo_include_in_sitemap: resolved.includeInSitemap,
  };
}

export function toBlogSeoDraftRpcArgs(settings?: BlogSeoSettings): BlogSeoDraftRpcArgs {
  const values = toBlogSeoPersistenceValues(settings);
  return {
    p_seo_allow_indexing: values.seo_allow_indexing,
    p_seo_allow_following: values.seo_allow_following,
    p_seo_include_in_sitemap: values.seo_include_in_sitemap,
  };
}
