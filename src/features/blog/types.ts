export type BlogPostStatus = "draft" | "review" | "scheduled" | "published" | "archived";

export type BlogInlineContent =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

export type BlogArticleParagraph =
  | string
  | { type: "rich_text"; content: BlogInlineContent[] };

export interface BlogArticleSection {
  heading: string;
  paragraphs: BlogArticleParagraph[];
}

/**
 * P.10-C6.SEO-IMPL-R0 compatibility contract.
 *
 * The flags are optional until the Blog Lab schema/RPC migration is explicitly
 * authorized. Public SEO builders must resolve missing values to the safe
 * legacy defaults (index/follow/sitemap = true), so this repository-only phase
 * does not change the behavior of existing articles.
 */
export interface BlogSeoSettings {
  allowIndexing?: boolean;
  allowFollowing?: boolean;
  includeInSitemap?: boolean;
}

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  featuredImage?: string;
  featuredImageAlt: string;
  seo?: BlogSeoSettings;
  status: BlogPostStatus;
  sections: BlogArticleSection[];
}
