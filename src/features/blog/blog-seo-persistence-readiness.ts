import { resolveBlogSeoSettings } from "./blog-seo-policy";
import type { BlogSeoSettings } from "./types";

/**
 * Repository-only safety gate for P.10-C6.SEO-IMPL-R3.
 * Keep false until the R2 persistence migration is explicitly applied and
 * validated in the real Blog Lab. This prevents selecting missing columns or
 * sending the 19-argument RPC contract to the current 16-argument endpoint.
 */
export const BLOG_SEO_PERSISTENCE_READY = false as const;

export const BLOG_SEO_PERSISTENCE_SELECT =
  "seo_allow_indexing,seo_allow_following,seo_include_in_sitemap" as const;

export function withBlogSeoPersistenceSelect(
  baseSelect: string,
  ready: boolean = BLOG_SEO_PERSISTENCE_READY,
) {
  return ready ? `${baseSelect},${BLOG_SEO_PERSISTENCE_SELECT}` : baseSelect;
}

export function persistedBlogSeoSettings(
  row: {
    seo_allow_indexing?: boolean | null;
    seo_allow_following?: boolean | null;
    seo_include_in_sitemap?: boolean | null;
  },
  ready: boolean = BLOG_SEO_PERSISTENCE_READY,
): Required<BlogSeoSettings> {
  if (!ready) return resolveBlogSeoSettings();
  return resolveBlogSeoSettings({
    allowIndexing: typeof row.seo_allow_indexing === "boolean" ? row.seo_allow_indexing : undefined,
    allowFollowing: typeof row.seo_allow_following === "boolean" ? row.seo_allow_following : undefined,
    includeInSitemap: typeof row.seo_include_in_sitemap === "boolean" ? row.seo_include_in_sitemap : undefined,
  });
}
