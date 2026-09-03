import { describe, expect, it } from "vitest";
import { listPreviewBlogArticles } from "./blog.repository";
import { articleToEditorialForm } from "./editorial-workflow";
import {
  createDraft,
  recordReviewDecision,
  schedulePost,
  submitReview,
  updateDraft,
} from "./editorial-mutations";
import {
  assertOptimisticWriteResult,
  executeEditorialTransaction,
  planEditorialTransaction,
  resolveEditorialReferences,
  type EditorialReferenceCatalog,
} from "./editorial-transaction-plan";

const actor = { userId: "editor-user", role: "editor" as const, authorId: null };
const reviewer = { userId: "reviewer-user", role: "reviewer" as const, authorId: null };

const catalog: EditorialReferenceCatalog = {
  categories: [
    { id: "cat-1", slug: "gestao-financeira", name: "Gestão Financeira", active: true },
    { id: "cat-2", slug: "gestao-empresarial", name: "Gestão Empresarial", active: true },
  ],
  authors: [
    {
      id: "author-1",
      slug: "equipe-editorial-vejamais-erp",
      displayName: "Equipe Editorial VEJAMAIS ERP",
      active: true,
    },
  ],
  tags: [
    { id: "tag-1", slug: "fluxo-de-caixa", name: "Fluxo de Caixa", active: true },
    { id: "tag-2", slug: "gestao", name: "Gestão", active: true },
  ],
};

function draft() {
  const article = listPreviewBlogArticles()[0];
  return {
    ...articleToEditorialForm(article),
    id: "11111111-1111-4111-8111-111111111111",
    category: "Gestão Financeira",
    author: "Equipe Editorial VEJAMAIS ERP",
    tags: ["Fluxo de Caixa", "gestao", "GESTÃO"],
    createdByUserId: actor.userId,
  };
}

describe("Fase 3-P reference resolution", () => {
  it("resolves category, author and tags to canonical active UUIDs", () => {
    const mutation = updateDraft(actor, draft());
    const result = resolveEditorialReferences(mutation, catalog);

    expect(result.issues).toEqual([]);
    expect(result.resolved).toEqual({
      categoryId: "cat-1",
      authorId: "author-1",
      tagIds: ["tag-1", "tag-2"],
    });
  });

  it("rejects missing references instead of guessing", () => {
    const mutation = updateDraft(actor, { ...draft(), category: "Categoria inexistente" });
    const result = resolveEditorialReferences(mutation, catalog);

    expect(result.resolved).toBeNull();
    expect(result.issues.some((issue) => issue.code === "BLOG_CATEGORY_REFERENCE_NOT_FOUND")).toBe(true);
  });

  it("rejects ambiguous references", () => {
    const ambiguous: EditorialReferenceCatalog = {
      ...catalog,
      categories: [
        ...catalog.categories,
        { id: "cat-3", slug: "outra", name: "Gestão Financeira", active: true },
      ],
    };
    const mutation = updateDraft(actor, draft());
    const result = resolveEditorialReferences(mutation, ambiguous);

    expect(result.resolved).toBeNull();
    expect(result.issues.some((issue) => issue.code === "BLOG_CATEGORY_REFERENCE_AMBIGUOUS")).toBe(true);
  });

  it("ignores inactive references", () => {
    const inactive: EditorialReferenceCatalog = {
      ...catalog,
      authors: catalog.authors.map((author) => ({ ...author, active: false })),
    };
    const result = resolveEditorialReferences(updateDraft(actor, draft()), inactive);

    expect(result.issues.some((issue) => issue.code === "BLOG_AUTHOR_REFERENCE_NOT_FOUND")).toBe(true);
  });
});

describe("Fase 3-P transaction planning", () => {
  it("plans create draft before tag inserts in one future transaction", () => {
    const form = { ...draft(), id: null };
    const plan = planEditorialTransaction(createDraft(actor, form), catalog);

    expect(plan.atomic).toBe(true);
    expect(plan.executable).toBe(false);
    expect(plan.steps.map((step) => step.operation)).toEqual(["insert_post", "insert_post_tags"]);
    expect(plan.steps[0].values).toMatchObject({ category_id: "cat-1", author_id: "author-1" });
    expect(plan.steps[1].values).toEqual([
      { post_id: "__INSERTED_POST_ID__", tag_id: "tag-1" },
      { post_id: "__INSERTED_POST_ID__", tag_id: "tag-2" },
    ]);
  });

  it("plans optimistic update before atomic tag replacement", () => {
    const plan = planEditorialTransaction(updateDraft(actor, draft()), catalog);

    expect(plan.optimisticConcurrency).toEqual({
      enabled: true,
      expectedRevision: 1,
      conflictCode: "BLOG_EDITORIAL_REVISION_CONFLICT",
    });
    expect(plan.steps.map((step) => step.operation)).toEqual([
      "update_post_optimistic",
      "delete_post_tags",
      "insert_post_tags",
    ]);
    expect(plan.steps[0].where).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      revision_number: 1,
    });
  });

  it("keeps status transitions protected by optimistic revision matching", () => {
    const mutation = submitReview(actor, draft());
    const plan = planEditorialTransaction(mutation, catalog);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].operation).toBe("update_post_optimistic");
    expect(plan.steps[0].expectedAffectedRows).toBe(1);
  });

  it("keeps review decisions as insert-only trigger-governed steps", () => {
    const form = { ...draft(), status: "review" as const, createdByUserId: actor.userId };
    const mutation = recordReviewDecision(reviewer, form, "approved", "Aprovado");
    const plan = planEditorialTransaction(mutation, catalog);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].operation).toBe("insert_review");
    expect(plan.steps[0].table).toBe("blog_post_reviews");
  });

  it("keeps schedule changes optimistic and feature-flagged off", () => {
    const form = {
      ...draft(),
      status: "review" as const,
      latestReviewDecision: "approved" as const,
      latestReviewerUserId: reviewer.userId,
      scheduledAt: "2030-09-02T15:00:00-03:00",
    };
    const plan = planEditorialTransaction(schedulePost(actor, form, new Date("2030-09-01T12:00:00-03:00")), catalog);

    expect(plan.featureFlag).toBe(false);
    expect(plan.executionMode).toBe("disabled_repository_only");
    expect(plan.steps[0].where).toMatchObject({ revision_number: 1 });
  });

  it("classifies zero-row or multi-row optimistic results as revision conflicts", () => {
    expect(() => assertOptimisticWriteResult(1)).not.toThrow();
    expect(() => assertOptimisticWriteResult(0)).toThrow("BLOG_EDITORIAL_REVISION_CONFLICT");
    expect(() => assertOptimisticWriteResult(2)).toThrow("BLOG_EDITORIAL_REVISION_CONFLICT");
  });

  it("keeps the final transaction executor fail-closed", async () => {
    const plan = planEditorialTransaction(updateDraft(actor, draft()), catalog);
    await expect(executeEditorialTransaction(plan)).rejects.toThrow("BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF");
  });

  it("emits no transaction steps when the client contract is rejected", () => {
    const invalid = updateDraft(actor, { ...draft(), title: "" });
    const plan = planEditorialTransaction(invalid, catalog);

    expect(plan.steps).toEqual([]);
    expect(plan.blockingReasons).toContain("BLOG_CLIENT_CONTRACT_REJECTED");
  });
});
