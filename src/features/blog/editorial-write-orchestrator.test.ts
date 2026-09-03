import { describe, expect, it } from "vitest";
import { articleToEditorialForm } from "./editorial-workflow";
import { listPreviewBlogArticles } from "./blog.repository";
import {
  executeEditorialWriteOrchestration,
  normalizeEditorialOrchestrationFailure,
  orchestrateEditorialWrite,
  type EditorialReferenceCatalogSnapshot,
} from "./editorial-write-orchestrator";

const actor = { userId: "editor-user", role: "editor" as const, authorId: null };
const reviewer = { userId: "reviewer-user", role: "reviewer" as const, authorId: null };

const catalog: EditorialReferenceCatalogSnapshot = {
  loadedAt: "2026-09-02T19:40:00Z",
  source: "repository_only_fixture",
  categories: [{ id: "cat-1", slug: "gestao-empresarial", name: "Gestão Empresarial", active: true }],
  authors: [{ id: "author-1", slug: "equipe-editorial-vejamais-erp", displayName: "Equipe Editorial VEJAMAIS ERP", active: true }],
  tags: [
    { id: "tag-1", slug: "gestao", name: "gestão", active: true },
    { id: "tag-2", slug: "erp", name: "ERP", active: true },
  ],
};

function draft() {
  const article = listPreviewBlogArticles()[0];
  return {
    ...articleToEditorialForm({ ...article, category: "Gestão Empresarial", author: "Equipe Editorial VEJAMAIS ERP", tags: ["gestão", "ERP"] }),
    createdByUserId: actor.userId,
  };
}

describe("Fase 3-Q repository-only editorial write orchestrator", () => {
  it("chains mutation, reference resolution and transaction planning", () => {
    const plan = orchestrateEditorialWrite({ command: "updateDraft", actor, form: draft(), catalog });

    expect(plan.mode).toBe("repository_only_disabled");
    expect(plan.executable).toBe(false);
    expect(plan.mutation.kind).toBe("updateDraft");
    expect(plan.transaction.atomic).toBe(true);
    expect(plan.transaction.referenceResolution.resolved).toEqual({
      categoryId: "cat-1",
      authorId: "author-1",
      tagIds: ["tag-1", "tag-2"],
    });
    expect(plan.readyForFutureExecution).toBe(true);
    expect(plan.blockingReasons).toContain("BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF");
  });

  it("keeps unresolved references blocked", () => {
    const plan = orchestrateEditorialWrite({
      command: "updateDraft",
      actor,
      form: { ...draft(), category: "Categoria inexistente" },
      catalog,
    });

    expect(plan.readyForFutureExecution).toBe(false);
    expect(plan.blockingReasons).toContain("BLOG_EDITORIAL_REFERENCES_UNRESOLVED");
    expect(plan.transaction.steps[0]?.where).toMatchObject({ revision_number: 1 });
  });

  it("preserves optimistic concurrency in the orchestration plan", () => {
    const form = { ...draft(), id: "post-1", revisionNumber: 7 };
    const plan = orchestrateEditorialWrite({ command: "updateDraft", actor, form, catalog });

    expect(plan.transaction.optimisticConcurrency).toEqual({
      enabled: true,
      expectedRevision: 7,
      conflictCode: "BLOG_EDITORIAL_REVISION_CONFLICT",
    });
    expect(plan.transaction.steps[0]?.where).toEqual({ id: "post-1", revision_number: 7 });
  });

  it("requires an explicit review decision", () => {
    const review = { ...draft(), status: "review" as const, createdByUserId: actor.userId };
    expect(() => orchestrateEditorialWrite({ command: "recordReviewDecision", actor: reviewer, form: review, catalog }))
      .toThrow("BLOG_REVIEW_DECISION_REQUIRED");
  });

  it("builds a review decision orchestration without changing post status", () => {
    const review = { ...draft(), status: "review" as const, createdByUserId: actor.userId };
    const plan = orchestrateEditorialWrite({
      command: "recordReviewDecision",
      actor: reviewer,
      form: review,
      catalog,
      reviewDecision: "approved",
      reviewNotes: "Aprovado para publicação.",
    });

    expect(plan.mutation.kind).toBe("recordReviewDecision");
    expect(plan.mutation.target.fromStatus).toBe("review");
    expect(plan.mutation.target.toStatus).toBe("review");
    expect(plan.transaction.steps[0]?.operation).toBe("insert_review");
  });

  it("rejects invalid catalog snapshots before orchestration", () => {
    expect(() => orchestrateEditorialWrite({
      command: "updateDraft",
      actor,
      form: draft(),
      catalog: { ...catalog, loadedAt: "invalid" },
    })).toThrow("BLOG_EDITORIAL_CATALOG_SNAPSHOT_INVALID");
  });

  it("fails closed at the final execution boundary", async () => {
    const plan = orchestrateEditorialWrite({ command: "updateDraft", actor, form: draft(), catalog });
    await expect(executeEditorialWriteOrchestration(plan))
      .rejects.toThrow("BLOG_EDITORIAL_ORCHESTRATOR_EXECUTION_DISABLED_REPOSITORY_ONLY");
  });

  it("normalizes orchestration and database failures", () => {
    expect(normalizeEditorialOrchestrationFailure(new Error("BLOG_EDITORIAL_CATALOG_SNAPSHOT_INVALID"))).toMatchObject({
      phase: "catalog",
      code: "BLOG_EDITORIAL_CATALOG_SNAPSHOT_INVALID",
    });

    expect(normalizeEditorialOrchestrationFailure({ code: "42501", message: "row-level security policy" }, "transaction")).toMatchObject({
      phase: "transaction",
      code: "42501",
      normalizedError: { category: "rls" },
    });
  });
});
