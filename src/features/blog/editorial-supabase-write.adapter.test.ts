import { describe, expect, it } from "vitest";
import { listPreviewBlogArticles } from "./blog.repository";
import { articleToEditorialForm } from "./editorial-workflow";
import {
  createDraft,
  recordReviewDecision,
  schedulePost,
  submitReview,
} from "./editorial-mutations";
import {
  EDITORIAL_SUPABASE_WRITES_ENABLED,
  EDITORIAL_SUPABASE_WRITE_MODE,
  executeSupabaseEditorialWrite,
  normalizeEditorialWriteError,
  planSupabaseEditorialWrite,
} from "./editorial-supabase-write.adapter";

describe("Fase 3-O disabled Supabase write adapter", () => {
  const owner = { userId: "owner-user", role: "owner" as const, authorId: null };
  const reviewer = { userId: "reviewer-user", role: "reviewer" as const, authorId: null };

  function draft() {
    return {
      ...articleToEditorialForm(listPreviewBlogArticles()[0]),
      id: null,
      createdByUserId: owner.userId,
      status: "draft" as const,
    };
  }

  it("keeps the hard write feature flag OFF", () => {
    expect(EDITORIAL_SUPABASE_WRITES_ENABLED).toBe(false);
    expect(EDITORIAL_SUPABASE_WRITE_MODE).toBe("disabled_repository_only");
  });

  it("maps createDraft to a non-executable post insert plus tag synchronization", () => {
    const mutation = createDraft(owner, draft());
    const plan = planSupabaseEditorialWrite(mutation);

    expect(plan.featureFlag).toBe(false);
    expect(plan.executable).toBe(false);
    expect(plan.blockingReason).toBe("BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF");
    expect(plan.steps.map((step) => [step.table, step.operation])).toEqual([
      ["blog_posts", "insert"],
      ["blog_post_tags", "replace_tags"],
    ]);
    expect(plan.unresolvedReferences).toEqual(["category_id", "author_id", "tag_ids"]);
    expect(plan.steps[0]?.values?.status).toBe("draft");
    expect(plan.steps[0]?.values?.category_id).toBe("__RESOLVE_BY_CATEGORY__");
  });

  it("maps submitReview to a guarded status update without bypass fields", () => {
    const form = { ...draft(), id: "11111111-1111-4111-8111-111111111111" };
    const mutation = submitReview(owner, form);
    const plan = planSupabaseEditorialWrite(mutation);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.table).toBe("blog_posts");
    expect(plan.steps[0]?.operation).toBe("update");
    expect(plan.steps[0]?.where).toEqual({ id: form.id, revision_number: 1 });
    expect(plan.steps[0]?.values).toEqual({ status: "review" });
    expect(plan.steps[0]?.values).not.toHaveProperty("reviewed_by");
    expect(plan.steps[0]?.values).not.toHaveProperty("updated_by");
  });

  it("maps review decision to blog_post_reviews and leaves reviewer authority to the trigger", () => {
    const form = {
      ...draft(),
      id: "22222222-2222-4222-8222-222222222222",
      status: "review" as const,
      createdByUserId: owner.userId,
    };
    const mutation = recordReviewDecision(reviewer, form, "approved", "Aprovado para publicação.");
    const plan = planSupabaseEditorialWrite(mutation);

    expect(plan.steps[0]?.table).toBe("blog_post_reviews");
    expect(plan.steps[0]?.operation).toBe("insert_review");
    expect(plan.steps[0]?.values).toEqual({
      post_id: form.id,
      revision_number: 1,
      decision: "approved",
      notes: "Aprovado para publicação.",
    });
    expect(plan.steps[0]?.values).not.toHaveProperty("reviewer_user_id");
  });

  it("maps scheduling without manufacturing publication metadata", () => {
    const form = {
      ...draft(),
      id: "33333333-3333-4333-8333-333333333333",
      status: "review" as const,
      latestReviewDecision: "approved" as const,
      latestReviewerUserId: reviewer.userId,
      scheduledAt: "2026-09-04T10:00:00-03:00",
    };
    const mutation = schedulePost(owner, form, new Date("2026-09-02T16:00:00-03:00"));
    const plan = planSupabaseEditorialWrite(mutation);

    expect(plan.steps[0]?.values).toEqual({
      status: "scheduled",
      scheduled_at: "2026-09-04T10:00:00-03:00",
    });
    expect(plan.steps[0]?.values).not.toHaveProperty("published_at");
    expect(plan.steps[0]?.values).not.toHaveProperty("reviewed_by");
  });

  it("fails closed if any caller attempts real execution", async () => {
    const plan = planSupabaseEditorialWrite(createDraft(owner, draft()));
    await expect(executeSupabaseEditorialWrite(plan)).rejects.toThrow("BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF");
  });

  it("normalizes Blog trigger errors without exposing raw database text", () => {
    const normalized = normalizeEditorialWriteError({
      code: "P0001",
      message: "BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN",
    });

    expect(normalized.code).toBe("BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN");
    expect(normalized.category).toBe("workflow");
    expect(normalized.source).toBe("blog_trigger");
  });

  it("normalizes RLS and unique conflicts", () => {
    const rls = normalizeEditorialWriteError({ code: "42501", message: "new row violates row-level security policy" });
    const conflict = normalizeEditorialWriteError({ code: "23505", message: "duplicate key value violates unique constraint" });

    expect(rls.category).toBe("rls");
    expect(conflict.category).toBe("conflict");
  });

  it("marks client-contract failures as blocked before the future adapter boundary", () => {
    const invalid = { ...draft(), title: "" };
    const mutation = createDraft(owner, invalid);
    const plan = planSupabaseEditorialWrite(mutation);

    expect(mutation.clientPlan.allowedByClientContract).toBe(false);
    expect(plan.blockingReason).toBe("BLOG_CLIENT_CONTRACT_REJECTED");
    expect(plan.executable).toBe(false);
  });
});
