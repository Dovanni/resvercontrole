import { blogSupabase } from "./blog-supabase";
import { normalizeBlogSections } from "./blog-content";
import type { EditorialEditorForm, EditorialReviewDecision } from "./editorial-workflow";
import { requireEditorialReadAccess } from "./editorial-read-model";

export interface EditorialEditorPostOption { id: string; title: string; status: string; revisionNumber: number }

type FullPostRow = {
  id: string; slug: string; title: string; excerpt: string; content: unknown; status: EditorialEditorForm["status"];
  revision_number: number; scheduled_at: string | null; published_at: string | null; featured_image_path: string | null;
  featured_image_alt: string | null; meta_title: string | null; meta_description: string | null; focus_keyword: string | null;
  reading_time_minutes: number; created_by: string;
  blog_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  blog_authors?: { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
  blog_post_tags?: Array<{ blog_tags?: { name?: string | null } | Array<{ name?: string | null }> | null }> | null;
};

const FULL_POST_SELECT = `id,slug,title,excerpt,content,status,revision_number,scheduled_at,published_at,featured_image_path,featured_image_alt,meta_title,meta_description,focus_keyword,reading_time_minutes,created_by,blog_categories(name),blog_authors(display_name),blog_post_tags(blog_tags(name))`;

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value ?? undefined; }

export async function listRealEditorialEditorOptions(): Promise<EditorialEditorPostOption[]> {
  await requireEditorialReadAccess();
  const { data, error } = await blogSupabase.from("blog_posts" as any).select("id,title,status,revision_number").order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({ id: row.id, title: row.title, status: row.status, revisionNumber: row.revision_number }));
}

export async function loadRealEditorialEditorForm(postId: string): Promise<EditorialEditorForm | null> {
  await requireEditorialReadAccess();
  const [{ data, error }, reviewResult] = await Promise.all([
    blogSupabase.from("blog_posts" as any).select(FULL_POST_SELECT).eq("id", postId).maybeSingle(),
    blogSupabase.from("blog_post_reviews" as any).select("decision,reviewer_user_id").eq("post_id", postId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw error;
  if (reviewResult.error) throw reviewResult.error;
  if (!data) return null;
  const row = data as unknown as FullPostRow;
  const review = reviewResult.data as any;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    sections: normalizeBlogSections(row.content),
    category: firstRelation(row.blog_categories)?.name?.trim() || "",
    author: firstRelation(row.blog_authors)?.display_name?.trim() || "",
    tags: (row.blog_post_tags ?? []).map((x) => firstRelation(x.blog_tags)?.name?.trim()).filter((x): x is string => Boolean(x)),
    featuredImagePath: row.featured_image_path || "",
    featuredImageAlt: row.featured_image_alt || "",
    metaTitle: row.meta_title || "",
    metaDescription: row.meta_description || "",
    focusKeyword: row.focus_keyword || "",
    readingTimeMinutes: row.reading_time_minutes,
    status: row.status,
    revisionNumber: row.revision_number,
    scheduledAt: row.scheduled_at || "",
    publishedAt: row.published_at || "",
    createdByUserId: row.created_by,
    latestReviewDecision: (review?.decision as EditorialReviewDecision | undefined) ?? null,
    latestReviewerUserId: review?.reviewer_user_id ?? null,
  };
}
