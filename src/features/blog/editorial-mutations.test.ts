import { describe, expect, it } from "vitest";
import { listPreviewBlogArticles } from "./blog.repository";
import { articleToEditorialForm } from "./editorial-workflow";
import {
  EDITORIAL_MUTATION_EXECUTION,
  archivePost,
  createDraft,
  executeEditorialMutation,
  publishPost,
  recordReviewDecision,
  restoreDraft,
  schedulePost,
  submitReview,
  updateDraft,
} from "./editorial-mutations";

const author = { userId: "author-user", role: "author" as const, authorId: "author-profile" };
const editor = { userId: "editor-user", role: "editor" as const, authorId: null };
const reviewer = { userId: "reviewer-user", role: "reviewer" as const, authorId: null };

function draft(createdByUserId = author.userId) {
  return { ...articleToEditorialForm(listPreviewBlogArticles()[0]), createdByUserId };
}

function approvedReview() {
  return {
    ...draft(author.userId),
    status: "review" as const,
    latestReviewDecision: "approved" as const,
    latestReviewerUserId: reviewer.userId,
  };
}

describe("Fase 3-N repository-only mutation contracts", () => {
  it("creates a normalized createDraft envelope without a persisted id", () => {
    const form = { ...draft(), id: "preview-local-id" };
    const mutation = createDraft(author, form);

    expect(mutation.kind).toBe("createDraft");
    expect(mutation.target.postId).toBeNull();
    expect(mutation.target.fromStatus).toBe("draft");
    expect(mutation.target.toStatus).toBe("draft");
    expect(mutation.clientPlan.allowedByClientContract).toBe(true);
    expect(mutation.execution).toBe(EDITORIAL_MUTATION_EXECUTION);
    expect(mutation.executable).toBe(false);
  });

  it("normalizes draft payload text but does not mutate the source form", () => {
    const form = { ...draft(), title: "  Título editorial  ", tags: [" gestão ", " ERP "] };
    const mutation = updateDraft(author, form);

    expect(mutation.payload.title).toBe("Título editorial");
    expect(mutation.payload.tags).toEqual(["gestão", "ERP"]);
    expect(form.title).toBe("  Título editorial  ");
  });

  it("plans draft to review while remaining non-executable", () => {
    const mutation = submitReview(author, draft());

    expect(mutation.target.toStatus).toBe("review");
    expect(mutation.clientPlan.allowedByClientContract).toBe(true);
    expect(mutation.executable).toBe(false);
  });

  it("separates review decisions from status transitions", () => {
    const review = { ...draft(author.userId), status: "review" as const };
    const mutation = recordReviewDecision(reviewer, review, "changes_requested", "Rever exemplo financeiro.");

    expect(mutation.payload.decision).toBe("changes_requested");
    expect(mutation.payload.notes).toBe("Rever exemplo financeiro.");
    expect(mutation.target.fromStatus).toBe("review");
    expect(mutation.target.toStatus).toBe("review");
  });

  it("preserves four-eyes in the review decision contract", () => {
    const selfReview = { ...draft(reviewer.userId), status: "review" as const };
    const mutation = recordReviewDecision(reviewer, selfReview, "approved");

    expect(mutation.clientPlan.allowedByClientContract).toBe(false);
    expect(mutation.clientPlan.issues.some((issue) => issue.code === "BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN")).toBe(true);
  });

  it("requires future scheduling and current approval", () => {
    const review = {
      ...approvedReview(),
      scheduledAt: "2026-09-03T10:00:00-03:00",
    };
    const mutation = schedulePost(editor, review, new Date("2026-09-02T15:00:00-03:00"));

    expect(mutation.target.toStatus).toBe("scheduled");
    expect(mutation.clientPlan.allowedByClientContract).toBe(true);
    expect(mutation.payload.scheduledAt).toBe("2026-09-03T10:00:00-03:00");
  });

  it("plans publication only for an approved current revision", () => {
    const mutation = publishPost(editor, approvedReview(), new Date("2026-09-02T15:00:00-03:00"));

    expect(mutation.target.toStatus).toBe("published");
    expect(mutation.clientPlan.allowedByClientContract).toBe(true);
  });

  it("models archive and restore without physical delete", () => {
    const published = { ...approvedReview(), status: "published" as const, publishedAt: "2026-09-02T12:00:00-03:00" };
    const archive = archivePost(editor, published);
    const restore = restoreDraft(editor, { ...published, status: "archived" as const });

    expect(archive.target.toStatus).toBe("archived");
    expect(archive.payload.note).toContain("sem exclusão física");
    expect(restore.target.toStatus).toBe("draft");
  });

  it("fails closed if any caller attempts execution", async () => {
    const mutation = submitReview(author, draft());

    await expect(executeEditorialMutation(mutation)).rejects.toThrow(
      "BLOG_MUTATION_EXECUTION_DISABLED_REPOSITORY_ONLY",
    );
  });
});
