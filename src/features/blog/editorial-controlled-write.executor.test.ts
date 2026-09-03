import { describe, expect, it } from "vitest";
import {
  EDITORIAL_CONTROLLED_WRITES_ENABLED,
  executeControlledEditorialWrite,
  normalizeControlledEditorialExecutionError,
  prepareControlledEditorialExecution,
} from "./editorial-controlled-write.executor";
import type { EditorialWriteOrchestrationPlan } from "./editorial-write-orchestrator";

function plan(stepCount = 1, ready = true): EditorialWriteOrchestrationPlan {
  return {
    mode: "repository_only_disabled",
    executable: false,
    command: "submitReview",
    catalogSnapshot: { loadedAt: "2026-09-02T20:00:00.000Z", source: "future_supabase_read", categoryCount: 1, authorCount: 1, tagCount: 0 },
    mutation: {} as any,
    transaction: {
      mutationKind: "submitReview",
      featureFlag: false,
      executionMode: "disabled_repository_only",
      executable: false,
      atomic: true,
      isolationExpectation: "single_database_transaction",
      optimisticConcurrency: { enabled: true, expectedRevision: 2, conflictCode: "BLOG_EDITORIAL_REVISION_CONFLICT" },
      referenceResolution: { resolved: null, issues: [] },
      steps: Array.from({ length: stepCount }, (_, index) => ({
        order: (index + 1) * 10,
        operation: "update_post_optimistic" as const,
        table: "blog_posts" as const,
        where: { id: "post-1", revision_number: 2 },
        values: { status: "review" },
        expectedAffectedRows: 1,
        note: "test",
      })),
      blockingReasons: ["BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF"],
    },
    readyForFutureExecution: ready,
    blockingReasons: ["BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF"],
  };
}

describe("Phase 3-U controlled editorial executor", () => {
  it("keeps the operational feature flag hard-coded off", () => {
    expect(EDITORIAL_CONTROLLED_WRITES_ENABLED).toBe(false);
  });

  it("classifies a valid one-statement plan without making it executable", () => {
    const execution = prepareControlledEditorialExecution(plan());
    expect(execution.safetyClass).toBe("single_statement");
    expect(execution.executable).toBe(false);
    expect(execution.blockingReasons).toContain("BLOG_EDITORIAL_CONTROLLED_WRITES_FEATURE_FLAG_OFF");
  });

  it("requires an atomic RPC for multi-step plans", () => {
    const execution = prepareControlledEditorialExecution(plan(3));
    expect(execution.safetyClass).toBe("requires_atomic_rpc");
    expect(execution.blockingReasons).toContain("BLOG_EDITORIAL_ATOMIC_RPC_REQUIRED");
  });

  it("blocks rejected client/orchestration plans", () => {
    const execution = prepareControlledEditorialExecution(plan(1, false));
    expect(execution.safetyClass).toBe("blocked_plan");
    expect(execution.blockingReasons).toContain("BLOG_EDITORIAL_EXECUTION_PLAN_REJECTED");
  });

  it("fails closed before any Supabase operation while flag is off", async () => {
    const execution = prepareControlledEditorialExecution(plan());
    await expect(executeControlledEditorialWrite(execution)).rejects.toThrow("BLOG_EDITORIAL_CONTROLLED_WRITES_FEATURE_FLAG_OFF");
  });

  it("normalizes optimistic concurrency conflicts as retryable", () => {
    const normalized = normalizeControlledEditorialExecutionError(new Error("BLOG_EDITORIAL_REVISION_CONFLICT"));
    expect(normalized.category).toBe("conflict");
    expect(normalized.retryable).toBe(true);
  });
});
