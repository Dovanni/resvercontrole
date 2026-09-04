import { blogSupabase } from "./blog-supabase";
import { loadEditorialReferenceCatalog } from "./editorial-read-model";
import {
  planEditorialCommand,
  type EditorialActor,
  type EditorialCommandKind,
  type EditorialEditorForm,
} from "./editorial-workflow";

export const EDITORIAL_OPERATIONAL_WRITES_ENABLED = true as const;
export const EDITORIAL_OPERATIONAL_WRITE_MODE = "live_blog_supabase" as const;

export interface EditorialOperationalWriteResult {
  ok: true;
  code: "BLOG_EDITORIAL_WRITE_OK";
  postId: string;
  revisionNumber: number;
  status: string;
}

export async function executeOperationalEditorialCommand(input: {
  actor: EditorialActor;
  form: EditorialEditorForm;
  command: EditorialCommandKind;
  reviewNotes?: string;
}): Promise<EditorialOperationalWriteResult> {
  if (!EDITORIAL_OPERATIONAL_WRITES_ENABLED) {
    throw new Error("BLOG_EDITORIAL_OPERATIONAL_WRITES_DISABLED");
  }

  const plan = planEditorialCommand(input.actor, input.form, input.command);
  if (!plan.allowedByClientContract) {
    throw new Error(plan.issues[0]?.code ?? "BLOG_EDITORIAL_CLIENT_CONTRACT_REJECTED");
  }

  switch (input.command) {
    case "save_draft":
      return saveDraft(input.form);
    case "submit_review":
      return transitionPost(input.form, "review");
    case "request_changes":
      return recordReview(input.form, "changes_requested", input.reviewNotes ?? "");
    case "approve_revision":
      return recordReview(input.form, "approved", input.reviewNotes ?? "");
    case "return_to_draft":
      return transitionPost(input.form, "draft");
    case "schedule":
      return transitionPost(input.form, "scheduled", {
        scheduled_at: new Date(input.form.scheduledAt).toISOString(),
      });
    case "publish":
      return transitionPost(input.form, "published");
    case "archive":
      return transitionPost(input.form, "archived");
    case "restore_draft":
      return transitionPost(input.form, "draft");
  }
}

async function saveDraft(form: EditorialEditorForm): Promise<EditorialOperationalWriteResult> {
  const catalog = await loadEditorialReferenceCatalog();
  const category = catalog.categories.find((item) => matchesReference(form.category, item.name, item.slug));
  const author = catalog.authors.find((item) => matchesReference(form.author, item.displayName, item.slug));
  const tagIds = form.tags.map((tag) => {
    const match = catalog.tags.find((item) => matchesReference(tag, item.name, item.slug));
    if (!match) throw new Error(`BLOG_TAG_REFERENCE_NOT_FOUND:${tag}`);
    return match.id;
  });

  if (!category) throw new Error("BLOG_CATEGORY_REFERENCE_NOT_FOUND");
  if (!author) throw new Error("BLOG_AUTHOR_REFERENCE_NOT_FOUND");

  const { data, error } = await (blogSupabase as any).rpc("blog_save_draft_transaction", {
    p_operation: form.id ? "update" : "create",
    p_post_id: form.id,
    p_expected_revision: form.id ? form.revisionNumber : null,
    p_slug: form.slug.trim(),
    p_title: form.title.trim(),
    p_excerpt: form.excerpt.trim(),
    p_content: form.sections,
    p_category_id: category.id,
    p_author_id: author.id,
    p_tag_ids: [...new Set(tagIds)],
    p_featured_image_path: form.featuredImagePath.trim(),
    p_featured_image_alt: form.featuredImageAlt.trim(),
    p_meta_title: form.metaTitle.trim(),
    p_meta_description: form.metaDescription.trim(),
    p_focus_keyword: form.focusKeyword.trim(),
    p_reading_time_minutes: form.readingTimeMinutes,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.post_id) throw new Error("BLOG_EDITORIAL_DRAFT_RPC_EMPTY_RESULT");
  return {
    ok: true,
    code: "BLOG_EDITORIAL_WRITE_OK",
    postId: String(row.post_id),
    revisionNumber: Number(row.revision_number),
    status: String(row.status),
  };
}

async function transitionPost(
  form: EditorialEditorForm,
  status: string,
  extraValues: Record<string, unknown> = {},
): Promise<EditorialOperationalWriteResult> {
  if (!form.id) throw new Error("BLOG_POST_ID_REQUIRED");

  const { data, error } = await (blogSupabase as any)
    .from("blog_posts")
    .update({ status, ...extraValues })
    .eq("id", form.id)
    .eq("revision_number", form.revisionNumber)
    .select("id,revision_number,status");

  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) throw new Error("BLOG_EDITORIAL_REVISION_CONFLICT");
  const row = data[0];
  return {
    ok: true,
    code: "BLOG_EDITORIAL_WRITE_OK",
    postId: String(row.id),
    revisionNumber: Number(row.revision_number),
    status: String(row.status),
  };
}

async function recordReview(
  form: EditorialEditorForm,
  decision: "approved" | "changes_requested",
  notes: string,
): Promise<EditorialOperationalWriteResult> {
  if (!form.id) throw new Error("BLOG_POST_ID_REQUIRED");

  const { error } = await (blogSupabase as any).from("blog_post_reviews").insert({
    post_id: form.id,
    revision_number: form.revisionNumber,
    decision,
    notes: notes.trim() || null,
  });
  if (error) throw error;

  return {
    ok: true,
    code: "BLOG_EDITORIAL_WRITE_OK",
    postId: form.id,
    revisionNumber: form.revisionNumber,
    status: form.status,
  };
}

function matchesReference(input: string, label: string, slug: string) {
  const normalized = input.trim().toLowerCase();
  return normalized === label.trim().toLowerCase() || normalized === slug.trim().toLowerCase();
}
