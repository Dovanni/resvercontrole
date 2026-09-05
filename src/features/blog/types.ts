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
  status: BlogPostStatus;
  sections: BlogArticleSection[];
}
