import { blogSupabase } from "./blog-supabase";
import type { BlogPostStatus } from "./types";
import type { EditorialMember, EditorialRole } from "./blog.repository";
import type {
  EditorialAuthorReferenceRecord,
  EditorialReferenceCatalog,
  EditorialReferenceRecord,
} from "./editorial-transaction-plan";

export type EditorialReviewDecision = "approved" | "changes_requested";

export interface EditorialAdminPostListItem {
  id: string;
  slug: string;
  title: string;
  status: BlogPostStatus;
  revisionNumber: number;
  category: string | null;
  author: string | null;
  updatedAt: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdBy: string;
  updatedBy: string | null;
}

export interface EditorialRevisionItem {
  id: string;
  postId: string;
  revisionNumber: number;
  createdBy: string | null;
  reason: string | null;
  createdAt: string;
}

export interface EditorialReviewItem {
  id: string;
  postId: string;
  revisionNumber: number;
  reviewerUserId: string;
  decision: EditorialReviewDecision;
  notes: string | null;
  createdAt: string;
}

export interface EditorialWorkflowEventItem {
  id: string;
  postId: string;
  fromStatus: BlogPostStatus | null;
  toStatus: BlogPostStatus;
  actorUserId: string | null;
  note: string | null;
  createdAt: string;
}

export interface EditorialPostReadModel {
  post: EditorialAdminPostListItem;
  revisions: EditorialRevisionItem[];
  reviews: EditorialReviewItem[];
  workflow: EditorialWorkflowEventItem[];
}

export interface EditorialAdministrativeReadModel {
  member: EditorialMember;
  posts: EditorialAdminPostListItem[];
  catalog: EditorialReferenceCatalog;
  loadedAt: string;
  mode: "read_only";
}

type PostRow = {
  id: string; slug: string; title: string; status: BlogPostStatus; revision_number: number;
  updated_at: string; scheduled_at: string | null; published_at: string | null;
  created_by: string; updated_by: string | null;
  blog_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  blog_authors?: { display_name?: string | null } | Array<{ display_name?: string | null }> | null;
};

type ReferenceRow = { id: string; slug: string; name: string; is_active: boolean };
type AuthorRow = { id: string; slug: string; display_name: string; is_active: boolean };

const ADMIN_POST_SELECT = `id,slug,title,status,revision_number,updated_at,scheduled_at,published_at,created_by,updated_by,blog_categories(name),blog_authors(display_name)`;

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export async function requireEditorialReadAccess(): Promise<EditorialMember> {
  const { data: authData, error: authError } = await blogSupabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("BLOG_EDITORIAL_AUTH_REQUIRED");

  const { data, error } = await blogSupabase
    .from("blog_editorial_members" as any)
    .select("user_id,role,author_id,active")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("BLOG_EDITORIAL_ACCESS_DENIED");

  const row = data as unknown as { user_id: string; role: EditorialRole; author_id: string | null; active: boolean };
  return { userId: row.user_id, role: row.role, authorId: row.author_id, active: row.active };
}

export async function loadEditorialReferenceCatalog(): Promise<EditorialReferenceCatalog> {
  const member = await requireEditorialReadAccess();
  void member;
  const [categoriesResult, authorsResult, tagsResult] = await Promise.all([
    blogSupabase.from("blog_categories" as any).select("id,slug,name,is_active").order("sort_order").order("name"),
    blogSupabase.from("blog_authors" as any).select("id,slug,display_name,is_active").order("display_name"),
    blogSupabase.from("blog_tags" as any).select("id,slug,name,is_active").order("name"),
  ]);
  for (const result of [categoriesResult, authorsResult, tagsResult]) if (result.error) throw result.error;

  return {
    categories: ((categoriesResult.data ?? []) as unknown as ReferenceRow[]).map(mapReference),
    authors: ((authorsResult.data ?? []) as unknown as AuthorRow[]).map(mapAuthorReference),
    tags: ((tagsResult.data ?? []) as unknown as ReferenceRow[]).map(mapReference),
  };
}

export async function listEditorialPosts(): Promise<EditorialAdminPostListItem[]> {
  await requireEditorialReadAccess();
  const { data, error } = await blogSupabase
    .from("blog_posts" as any)
    .select(ADMIN_POST_SELECT)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PostRow[]).map(mapPostListItem);
}

export async function getEditorialPostReadModel(postId: string): Promise<EditorialPostReadModel | null> {
  await requireEditorialReadAccess();
  const [postResult, revisionsResult, reviewsResult, workflowResult] = await Promise.all([
    blogSupabase.from("blog_posts" as any).select(ADMIN_POST_SELECT).eq("id", postId).maybeSingle(),
    blogSupabase.from("blog_post_revisions" as any).select("id,post_id,revision_number,created_by,reason,created_at").eq("post_id", postId).order("revision_number", { ascending: false }),
    blogSupabase.from("blog_post_reviews" as any).select("id,post_id,revision_number,reviewer_user_id,decision,notes,created_at").eq("post_id", postId).order("created_at", { ascending: false }),
    blogSupabase.from("blog_workflow_events" as any).select("id,post_id,from_status,to_status,actor_user_id,note,created_at").eq("post_id", postId).order("created_at", { ascending: false }),
  ]);
  for (const result of [postResult, revisionsResult, reviewsResult, workflowResult]) if (result.error) throw result.error;
  if (!postResult.data) return null;

  return {
    post: mapPostListItem(postResult.data as unknown as PostRow),
    revisions: ((revisionsResult.data ?? []) as any[]).map((row) => ({ id: row.id, postId: row.post_id, revisionNumber: row.revision_number, createdBy: row.created_by, reason: row.reason, createdAt: row.created_at })),
    reviews: ((reviewsResult.data ?? []) as any[]).map((row) => ({ id: row.id, postId: row.post_id, revisionNumber: row.revision_number, reviewerUserId: row.reviewer_user_id, decision: row.decision, notes: row.notes, createdAt: row.created_at })),
    workflow: ((workflowResult.data ?? []) as any[]).map((row) => ({ id: row.id, postId: row.post_id, fromStatus: row.from_status, toStatus: row.to_status, actorUserId: row.actor_user_id, note: row.note, createdAt: row.created_at })),
  };
}

export async function loadEditorialAdministrativeReadModel(): Promise<EditorialAdministrativeReadModel> {
  const member = await requireEditorialReadAccess();
  const [posts, catalog] = await Promise.all([listEditorialPosts(), loadEditorialReferenceCatalog()]);
  return { member, posts, catalog, loadedAt: new Date().toISOString(), mode: "read_only" };
}

export function mapPostListItem(row: PostRow): EditorialAdminPostListItem {
  return {
    id: row.id, slug: row.slug, title: row.title, status: row.status, revisionNumber: row.revision_number,
    category: firstRelation(row.blog_categories)?.name?.trim() || null,
    author: firstRelation(row.blog_authors)?.display_name?.trim() || null,
    updatedAt: row.updated_at, scheduledAt: row.scheduled_at, publishedAt: row.published_at,
    createdBy: row.created_by, updatedBy: row.updated_by,
  };
}

export function mapReference(row: ReferenceRow): EditorialReferenceRecord {
  return { id: row.id, slug: row.slug, name: row.name, active: row.is_active };
}

export function mapAuthorReference(row: AuthorRow): EditorialAuthorReferenceRecord {
  return { id: row.id, slug: row.slug, displayName: row.display_name, active: row.is_active };
}
