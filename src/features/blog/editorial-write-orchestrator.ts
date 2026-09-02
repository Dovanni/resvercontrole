import type { EditorialActor, EditorialEditorForm, EditorialReviewDecision } from "./editorial-workflow";
import {
  archivePost,
  createDraft,
  publishPost,
  recordReviewDecision,
  restoreDraft,
  returnToDraft,
  schedulePost,
  submitReview,
  updateDraft,
  type EditorialMutationEnvelope,
} from "./editorial-mutations";
import {
  normalizeEditorialWriteError,
  type NormalizedEditorialWriteError,
} from "./editorial-supabase-write.adapter";
import {
  planEditorialTransaction,
  type EditorialReferenceCatalog,
  type EditorialTransactionPlan,
} from "./editorial-transaction-plan";

export const EDITORIAL_WRITE_ORCHESTRATOR_MODE = "repository_only_disabled" as const;

export type EditorialOrchestrationCommand =
  | "createDraft"
  | "updateDraft"
  | "submitReview"
  | "recordReviewDecision"
  | "returnToDraft"
  | "schedulePost"
  | "publishPost"
  | "archivePost"
  | "restoreDraft";

export interface EditorialReferenceCatalogSnapshot extends EditorialReferenceCatalog {
  loadedAt: string;
  source: "repository_only_fixture" | "future_supabase_read";
}

export interface EditorialWriteOrchestrationInput {
  command: EditorialOrchestrationCommand;
  actor: EditorialActor;
  form: EditorialEditorForm;
  catalog: EditorialReferenceCatalogSnapshot;
  reviewDecision?: EditorialReviewDecision;
  reviewNotes?: string;
  now?: Date;
}

export interface EditorialWriteOrchestrationPlan {
  mode: typeof EDITORIAL_WRITE_ORCHESTRATOR_MODE;
  executable: false;
  command: EditorialOrchestrationCommand;
  catalogSnapshot: {
    loadedAt: string;
    source: EditorialReferenceCatalogSnapshot["source"];
    categoryCount: number;
    authorCount: number;
    tagCount: number;
  };
  mutation: EditorialMutationEnvelope;
  transaction: EditorialTransactionPlan;
  readyForFutureExecution: boolean;
  blockingReasons: string[];
}

export interface EditorialOrchestrationResult {
  ok: boolean;
  phase: "catalog" | "mutation" | "transaction" | "execution";
  code: string;
  message: string;
  normalizedError?: NormalizedEditorialWriteError;
}

export function orchestrateEditorialWrite(input: EditorialWriteOrchestrationInput): EditorialWriteOrchestrationPlan {
  validateCatalogSnapshot(input.catalog);
  const mutation = buildMutation(input);
  const transaction = planEditorialTransaction(mutation, input.catalog);
  const blockingReasons = [
    ...transaction.blockingReasons,
    ...(transaction.referenceResolution.issues.length ? ["BLOG_EDITORIAL_REFERENCES_UNRESOLVED"] : []),
  ];

  return {
    mode: EDITORIAL_WRITE_ORCHESTRATOR_MODE,
    executable: false,
    command: input.command,
    catalogSnapshot: {
      loadedAt: input.catalog.loadedAt,
      source: input.catalog.source,
      categoryCount: input.catalog.categories.length,
      authorCount: input.catalog.authors.length,
      tagCount: input.catalog.tags.length,
    },
    mutation,
    transaction,
    readyForFutureExecution:
      mutation.clientPlan.allowedByClientContract &&
      transaction.referenceResolution.issues.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
  };
}

/** Final Phase 3-Q boundary: orchestration can be planned, never executed. */
export async function executeEditorialWriteOrchestration(_plan: EditorialWriteOrchestrationPlan): Promise<never> {
  throw new Error("BLOG_EDITORIAL_ORCHESTRATOR_EXECUTION_DISABLED_REPOSITORY_ONLY");
}

export function normalizeEditorialOrchestrationFailure(
  error: unknown,
  phase: EditorialOrchestrationResult["phase"] = "execution",
): EditorialOrchestrationResult {
  if (error instanceof Error && error.message === "BLOG_EDITORIAL_CATALOG_SNAPSHOT_INVALID") {
    return {
      ok: false,
      phase: "catalog",
      code: error.message,
      message: "O snapshot de referências editoriais é inválido ou não possui data de carregamento válida.",
    };
  }

  if (error instanceof Error && error.message === "BLOG_REVIEW_DECISION_REQUIRED") {
    return {
      ok: false,
      phase: "mutation",
      code: error.message,
      message: "Informe a decisão da revisão antes de montar a mutação editorial.",
    };
  }

  if (error instanceof Error && error.message === "BLOG_EDITORIAL_ORCHESTRATOR_EXECUTION_DISABLED_REPOSITORY_ONLY") {
    return {
      ok: false,
      phase: "execution",
      code: error.message,
      message: "A execução real do orquestrador editorial permanece bloqueada nesta fase.",
    };
  }

  const normalizedError = normalizeEditorialWriteError(error);
  return {
    ok: false,
    phase,
    code: normalizedError.code,
    message: normalizedError.message,
    normalizedError,
  };
}

function buildMutation(input: EditorialWriteOrchestrationInput): EditorialMutationEnvelope {
  switch (input.command) {
    case "createDraft": return createDraft(input.actor, input.form);
    case "updateDraft": return updateDraft(input.actor, input.form);
    case "submitReview": return submitReview(input.actor, input.form);
    case "recordReviewDecision":
      if (!input.reviewDecision) throw new Error("BLOG_REVIEW_DECISION_REQUIRED");
      return recordReviewDecision(input.actor, input.form, input.reviewDecision, input.reviewNotes ?? "");
    case "returnToDraft": return returnToDraft(input.actor, input.form);
    case "schedulePost": return schedulePost(input.actor, input.form, input.now ?? new Date());
    case "publishPost": return publishPost(input.actor, input.form, input.now ?? new Date());
    case "archivePost": return archivePost(input.actor, input.form);
    case "restoreDraft": return restoreDraft(input.actor, input.form);
  }
}

function validateCatalogSnapshot(catalog: EditorialReferenceCatalogSnapshot) {
  const loadedAt = Date.parse(catalog.loadedAt);
  if (!catalog.loadedAt || Number.isNaN(loadedAt)) throw new Error("BLOG_EDITORIAL_CATALOG_SNAPSHOT_INVALID");
}
