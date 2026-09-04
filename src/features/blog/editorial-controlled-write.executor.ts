import { blogSupabase as supabase } from "./blog-supabase";
import type { EditorialWriteOrchestrationPlan } from "./editorial-write-orchestrator";
import { normalizeEditorialWriteError, type NormalizedEditorialWriteError } from "./editorial-supabase-write.adapter";

/**
 * Phase 3-U legacy controlled gate.
 * This path remains fail-closed; the explicitly authorized operational path
 * lives in editorial-operational-write.ts and also uses the dedicated Blog client.
 */
export const EDITORIAL_CONTROLLED_WRITES_ENABLED = false as const;
export const EDITORIAL_CONTROLLED_WRITE_MODE = "connected_but_disabled" as const;

export type ControlledWriteSafetyClass = "single_statement" | "requires_atomic_rpc" | "blocked_plan";

export interface ControlledEditorialExecutionPlan {
  featureFlag: typeof EDITORIAL_CONTROLLED_WRITES_ENABLED;
  mode: typeof EDITORIAL_CONTROLLED_WRITE_MODE;
  executable: false;
  safetyClass: ControlledWriteSafetyClass;
  command: EditorialWriteOrchestrationPlan["command"];
  operationCount: number;
  blockingReasons: string[];
  transaction: EditorialWriteOrchestrationPlan["transaction"];
}

export interface ControlledEditorialExecutionResult {
  ok: boolean;
  code: string;
  affectedRows: number;
  normalizedError?: NormalizedEditorialWriteError;
}

export function prepareControlledEditorialExecution(plan: EditorialWriteOrchestrationPlan): ControlledEditorialExecutionPlan {
  const transaction = plan.transaction;
  const operations = transaction.steps;
  const clientRejected = !plan.readyForFutureExecution || transaction.referenceResolution.issues.length > 0;
  const requiresAtomicRpc = operations.length > 1;
  const safetyClass: ControlledWriteSafetyClass = clientRejected
    ? "blocked_plan"
    : requiresAtomicRpc
      ? "requires_atomic_rpc"
      : "single_statement";

  const blockingReasons = [
    ...plan.blockingReasons,
    ...(clientRejected ? ["BLOG_EDITORIAL_EXECUTION_PLAN_REJECTED"] : []),
    ...(requiresAtomicRpc ? ["BLOG_EDITORIAL_ATOMIC_RPC_REQUIRED"] : []),
    "BLOG_EDITORIAL_CONTROLLED_WRITES_FEATURE_FLAG_OFF",
  ];

  return {
    featureFlag: EDITORIAL_CONTROLLED_WRITES_ENABLED,
    mode: EDITORIAL_CONTROLLED_WRITE_MODE,
    executable: false,
    safetyClass,
    command: plan.command,
    operationCount: operations.length,
    blockingReasons: [...new Set(blockingReasons)],
    transaction,
  };
}

export async function executeControlledEditorialWrite(
  execution: ControlledEditorialExecutionPlan,
): Promise<ControlledEditorialExecutionResult> {
  if (!EDITORIAL_CONTROLLED_WRITES_ENABLED) {
    throw new Error("BLOG_EDITORIAL_CONTROLLED_WRITES_FEATURE_FLAG_OFF");
  }
  if (execution.safetyClass === "requires_atomic_rpc") throw new Error("BLOG_EDITORIAL_ATOMIC_RPC_REQUIRED");
  if (execution.safetyClass !== "single_statement") throw new Error("BLOG_EDITORIAL_EXECUTION_PLAN_REJECTED");

  const step = execution.transaction.steps[0];
  if (!step) throw new Error("BLOG_EDITORIAL_EXECUTION_STEP_REQUIRED");

  try {
    switch (step.operation) {
      case "insert_review": {
        const { error } = await supabase.from("blog_post_reviews" as any).insert(step.values as any);
        if (error) throw error;
        return { ok: true, code: "BLOG_EDITORIAL_WRITE_OK", affectedRows: 1 };
      }
      case "update_post_optimistic": {
        const where = step.where ?? {};
        const id = String(where.id ?? "");
        const revisionNumber = Number(where.revision_number);
        const { data, error } = await supabase
          .from("blog_posts" as any)
          .update(step.values as any)
          .eq("id", id)
          .eq("revision_number", revisionNumber)
          .select("id");
        if (error) throw error;
        const affectedRows = Array.isArray(data) ? data.length : 0;
        if (affectedRows !== 1) throw new Error("BLOG_EDITORIAL_REVISION_CONFLICT");
        return { ok: true, code: "BLOG_EDITORIAL_WRITE_OK", affectedRows };
      }
      case "insert_post":
      case "delete_post_tags":
      case "insert_post_tags":
        throw new Error("BLOG_EDITORIAL_ATOMIC_RPC_REQUIRED");
    }
  } catch (error) {
    const normalizedError = normalizeControlledEditorialExecutionError(error);
    return { ok: false, code: normalizedError.code, affectedRows: 0, normalizedError };
  }
}

export function normalizeControlledEditorialExecutionError(error: unknown): NormalizedEditorialWriteError {
  if (error instanceof Error && error.message === "BLOG_EDITORIAL_REVISION_CONFLICT") {
    return { code: error.message, category: "conflict", retryable: true, message: "O artigo foi alterado por outra sessão. Recarregue a revisão atual antes de tentar novamente.", source: "unknown" };
  }
  if (error instanceof Error && error.message === "BLOG_EDITORIAL_ATOMIC_RPC_REQUIRED") {
    return { code: error.message, category: "constraint", retryable: false, message: "Esta operação exige uma RPC transacional no banco antes que a escrita possa ser habilitada.", source: "unknown" };
  }
  return normalizeEditorialWriteError(error);
}
