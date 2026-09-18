import { blogSupabase } from "./blog-supabase";
import { BLOG_ARTICLES } from "./articles";
import { normalizeBlogSections } from "./blog-content";
import {
  persistedBlogSeoSettings,
  withBlogSeoPersistenceSelect,
} from "./blog-seo-persistence-readiness";
import type { BlogArticle, BlogPostStatus } from "./types";

export type EditorialRole = "owner" | "editor" | "author" | "reviewer";

export interface EditorialMember {
  userId: string;
  role: EditorialRole;
  authorId: string | null;
  active: boolean;
}

export interface EditorialDashboardSnapshot {
  posts: Record<BlogPostStatus, number>;
  categories: number;
  tags: number;
  authors: number;
}

type PublicBlogPostRpcRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: unknown;
  published_at: string;
  updated_at: string;
  reading_time_minutes: number;
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  featured_image_path: string | null;
  featured_image_alt: string | null;
  seo_allow_indexing: boolean;
  seo_allow_following: boolean;
  seo_include_in_sitemap: boolean;
  category: string;
  author: string;
  tags: string[];
  published_revision_number: number;
};

type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: unknown;
  status: BlogPostStatus;
  published_at: string | null;
  updated_at: string;
  reading_time_minutes: number;
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  featured_image_path: string | null;
  featured_image_alt: string | null;
  seo_allow_indexing?: boolean | null;
  seo_allow_following?: boolean | null;
  seo_include_in_sitemap?: boolean | null;
  blog_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  blog_authors?: { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
  blog_post_tags?: Array<{ blog_tags?: { name?: string | null } | Array<{ name?: string | null }> | null }> | null;
};

const BLOG_POST_SELECT = withBlogSeoPersistenceSelect(`
  id,
  slug,
  title,
  excerpt,
  content,
  status,
  published_at,
  updated_at,
  reading_time_minutes,
  meta_title,
  meta_description,
  focus_keyword,
  featured_image_path,
  featured_image_alt,
  blog_categories(name),
  blog_authors(display_name),
  blog_post_tags(blog_tags(name))
`);

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function publicStorageUrl(path: string | null) {
  if (!path) return undefined;
  return blogSupabase.storage.from("blog-media").getPublicUrl(path).data.publicUrl;
}

export function mapPublishedBlogPost(row: BlogPostRow): BlogArticle {
  const category = firstRelation(row.blog_categories)?.name?.trim() || "VEJAMAIS ERP";
  const author = firstRelation(row.blog_authors)?.display_name?.trim() || "Equipe Editorial VEJAMAIS ERP";
  const tags = (row.blog_post_tags ?? [])
    .map((item) => firstRelation(item.blog_tags)?.name?.trim())
    .filter((item): item is string => Boolean(item));

  if (row.status !== "published" || !row.published_at) {
    throw new Error("BLOG_REPOSITORY_EXPECTED_PUBLISHED_POST");
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category,
    tags,
    author,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readingTimeMinutes: row.reading_time_minutes,
    metaTitle: row.meta_title?.trim() || `${row.title} | VEJAMAIS ERP`,
    metaDescription: row.meta_description?.trim() || row.excerpt,
    focusKeyword: row.focus_keyword?.trim() || row.title,
    featuredImage: publicStorageUrl(row.featured_image_path),
    featuredImageAlt: row.featured_image_alt?.trim() || `Imagem editorial de ${row.title}`,
    seo: persistedBlogSeoSettings(row),
    status: row.status,
    sections: normalizeBlogSections(row.content),
  };
}

/**
 * Preview repository: intentionally local while the approved drafts have not
 * been imported to Supabase. Routes must consume this abstraction rather than
 * importing BLOG_ARTICLES directly so the data source can be switched safely.
 */
export function listPreviewBlogArticles(): BlogArticle[] {
  return BLOG_ARTICLES;
}

export function getPreviewBlogArticleBySlug(slug: string) {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}

export function getRelatedPreviewBlogArticles(article: BlogArticle, limit = 2) {
  return BLOG_ARTICLES.filter((candidate) => candidate.slug !== article.slug)
    .map((candidate) => ({
      article: candidate,
      score:
        (candidate.category === article.category ? 3 : 0) +
        candidate.tags.filter((tag) => article.tags.includes(tag)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.article);
}

function mapPublicBlogPostRpcRow(row: PublicBlogPostRpcRow): BlogArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category.trim() || "VEJAMAIS ERP",
    tags: row.tags ?? [],
    author: row.author.trim() || "Equipe Editorial VEJAMAIS ERP",
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readingTimeMinutes: row.reading_time_minutes,
    metaTitle: row.meta_title?.trim() || `${row.title} | VEJAMAIS ERP`,
    metaDescription: row.meta_description?.trim() || row.excerpt,
    focusKeyword: row.focus_keyword?.trim() || row.title,
    featuredImage: publicStorageUrl(row.featured_image_path),
    featuredImageAlt: row.featured_image_alt?.trim() || `Imagem editorial de ${row.title}`,
    seo: persistedBlogSeoSettings(row),
    status: "published",
    sections: normalizeBlogSections(row.content),
  };
}

/**
 * Zero-downtime public reader. This repository change must only be deployed
 * after the matching database migration exposes both RPCs.
 */
export async function listPublishedBlogArticles(): Promise<BlogArticle[]> {
  const { data, error } = await (blogSupabase as any).rpc("blog_public_list_posts");
  if (error) throw error;
  return ((data ?? []) as PublicBlogPostRpcRow[]).map(mapPublicBlogPostRpcRow);
}

export async function getPublishedBlogArticleBySlug(slug: string): Promise<BlogArticle | undefined> {
  const { data, error } = await (blogSupabase as any).rpc("blog_public_get_post_by_slug", {
    p_slug: slug,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapPublicBlogPostRpcRow(row as PublicBlogPostRpcRow) : undefined;
}

export async function getCurrentEditorialMember(userId: string): Promise<EditorialMember | null> {
  const { data, error } = await blogSupabase
    .from("blog_editorial_members" as any)
    .select("user_id, role, author_id, active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as { user_id: string; role: EditorialRole; author_id: string | null; active: boolean };
  return { userId: row.user_id, role: row.role, authorId: row.author_id, active: row.active };
}

async function countRows(table: string, status?: BlogPostStatus) {
  let query = blogSupabase.from(table as any).select("*", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Read-only summary for the protected editorial shell. */
export async function getEditorialDashboardSnapshot(): Promise<EditorialDashboardSnapshot> {
  const { data: authData, error: authError } = await blogSupabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("BLOG_EDITORIAL_AUTH_REQUIRED");

  const member = await getCurrentEditorialMember(authData.user.id);
  if (!member) throw new Error("BLOG_EDITORIAL_ACCESS_DENIED");

  const [draft, review, scheduled, published, archived, categories, tags, authors] = await Promise.all([
    countRows("blog_posts", "draft"),
    countRows("blog_posts", "review"),
    countRows("blog_posts", "scheduled"),
    countRows("blog_posts", "published"),
    countRows("blog_posts", "archived"),
    countRows("blog_categories"),
    countRows("blog_tags"),
    countRows("blog_authors"),
  ]);

  return {
    posts: { draft, review, scheduled, published, archived },
    categories,
    tags,
    authors,
  };
}
