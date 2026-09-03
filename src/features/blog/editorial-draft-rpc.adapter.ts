import type { EditorialWriteOrchestrationPlan } from "./editorial-write-orchestrator";

export const EDITORIAL_DRAFT_RPC_NAME = "blog_save_draft_transaction" as const;
export const EDITORIAL_DRAFT_RPC_MODE = "repository_only_disabled" as const;

export interface EditorialDraftRpcArgs {
  p_operation: "create" | "update";
  p_post_id: string | null;
  p_expected_revision: number | null;
  p_slug: string;
  p_title: string;
  p_excerpt: string;
  p_content: unknown;
  p_category_id: string;
  p_author_id: string;
  p_tag_ids: string[];
  p_featured_image_path: string;
  p_featured_image_alt: string;
  p_meta_title: string;
  p_meta_description: string;
  p_focus_keyword: string;
  p_reading_time_minutes: number;
}

export interface EditorialDraftRpcPlan {
  functionName: typeof EDITORIAL_DRAFT_RPC_NAME;
  mode: typeof EDITORIAL_DRAFT_RPC_MODE;
  executable: false;
  atomic: true;
  command: "createDraft" | "updateDraft";
  args: EditorialDraftRpcArgs;
  blockingReason: "BLOG_EDITORIAL_DRAFT_RPC_NOT_APPLIED_OR_ENABLED";
}

export function planEditorialDraftRpc(orchestration: EditorialWriteOrchestrationPlan): EditorialDraftRpcPlan {
  if (orchestration.command !== "createDraft" && orchestration.command !== "updateDraft") {
    throw new Error("BLOG_EDITORIAL_DRAFT_RPC_COMMAND_UNSUPPORTED");
  }
  if (!orchestration.readyForFutureExecution || !orchestration.transaction.referenceResolution.resolved) {
    throw new Error("BLOG_EDITORIAL_DRAFT_RPC_PLAN_NOT_READY");
  }

  const resolved = orchestration.transaction.referenceResolution.resolved;
  const postStep = orchestration.transaction.steps.find((step) => step.table === "blog_posts");
  if (!postStep?.values) throw new Error("BLOG_EDITORIAL_DRAFT_RPC_POST_VALUES_REQUIRED");

  const values = postStep.values as Record<string, unknown>;
  const tagStep = orchestration.transaction.steps.find((step) => step.operation === "insert_post_tags");
  const tagRows = Array.isArray(tagStep?.values) ? tagStep.values : [];
  const tagIds = tagRows
    .map((row) => row.tag_id)
    .filter((value): value is string => typeof value === "string");

  return {
    functionName: EDITORIAL_DRAFT_RPC_NAME,
    mode: EDITORIAL_DRAFT_RPC_MODE,
    executable: false,
    atomic: true,
    command: orchestration.command,
    args: {
      p_operation: orchestration.command === "createDraft" ? "create" : "update",
      p_post_id: orchestration.mutation.target.postId,
      p_expected_revision: orchestration.command === "createDraft" ? null : orchestration.mutation.target.revisionNumber,
      p_slug: String(values.slug ?? ""),
      p_title: String(values.title ?? ""),
      p_excerpt: String(values.excerpt ?? ""),
      p_content: values.content ?? [],
      p_category_id: resolved.categoryId,
      p_author_id: resolved.authorId,
      p_tag_ids: tagIds.length > 0 ? [...new Set(tagIds)].sort() : resolved.tagIds,
      p_featured_image_path: String(values.featured_image_path ?? ""),
      p_featured_image_alt: String(values.featured_image_alt ?? ""),
      p_meta_title: String(values.meta_title ?? ""),
      p_meta_description: String(values.meta_description ?? ""),
      p_focus_keyword: String(values.focus_keyword ?? ""),
      p_reading_time_minutes: Number(values.reading_time_minutes ?? 1),
    },
    blockingReason: "BLOG_EDITORIAL_DRAFT_RPC_NOT_APPLIED_OR_ENABLED",
  };
}

export async function executeEditorialDraftRpc(_plan: EditorialDraftRpcPlan): Promise<never> {
  throw new Error("BLOG_EDITORIAL_DRAFT_RPC_NOT_APPLIED_OR_ENABLED");
}
