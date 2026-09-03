export type BlogPostStatus = "draft" | "review" | "scheduled" | "published" | "archived";

export interface BlogArticleSection {
  heading: string;
  paragraphs: string[];
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
