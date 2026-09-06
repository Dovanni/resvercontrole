import type { BlogArticle, BlogSeoSettings } from "./types";

export interface ResolvedBlogSeoSettings {
  allowIndexing: boolean;
  allowFollowing: boolean;
  includeInSitemap: boolean;
}

/**
 * Repository-only compatibility resolver for P.10-C6.SEO-IMPL-R0.
 * Missing values preserve the current production behavior.
 */
export function resolveBlogSeoSettings(settings?: BlogSeoSettings): ResolvedBlogSeoSettings {
  const allowIndexing = settings?.allowIndexing ?? true;
  const allowFollowing = settings?.allowFollowing ?? true;
  const requestedSitemap = settings?.includeInSitemap ?? true;

  return {
    allowIndexing,
    allowFollowing,
    includeInSitemap: allowIndexing && requestedSitemap,
  };
}

export function buildBlogRobotsContent(article: Pick<BlogArticle, "seo">) {
  const seo = resolveBlogSeoSettings(article.seo);
  const indexDirective = seo.allowIndexing ? "index" : "noindex";
  const followDirective = seo.allowFollowing ? "follow" : "nofollow";
  return seo.allowIndexing
    ? `${indexDirective}, ${followDirective}, max-image-preview:large`
    : `${indexDirective}, ${followDirective}`;
}

export function shouldIncludeArticleInSitemap(article: Pick<BlogArticle, "seo">) {
  return resolveBlogSeoSettings(article.seo).includeInSitemap;
}
