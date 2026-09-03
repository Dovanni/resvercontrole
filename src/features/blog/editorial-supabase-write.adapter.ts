import type { BlogPostStatus } from "./types";
import type {
  DraftMutationPayload,
  EditorialMutationEnvelope,
  EditorialMutationKind,
  ReviewDecisionPayload,
  SchedulePayload,
  StatusMutationPayload,
} from "./editorial-mutations";

/**
 * Phase 3-O hard gate.
 *
 * This constant is intentionally not environment-driven. Turning writes on
 * requires a code change, review and a later explicit authorization phase.
 */
export const EDITORIAL_SUPABASE_WRITES_ENABLED = false as const;
export const EDITORIAL_SUPABASE_WRITE_MODE = "disabled_repository_only" as const;

export type SupabaseEditorialTable =
  | "blog_posts"
  | "blog_post_tags"
  | "blog_post_reviews";

export type SupabaseEditorialOperation = "insert" | "update" | "replace_tags" | "insert_review";

export interface SupabaseEditorialWriteStep {
  table: SupabaseEditorialTable;
  operation: SupabaseEditorialOperation;
  where?: Record<string, string | number>;
  values?: Record<string, unknown>;
  note: string;
}

export interface SupabaseEditorialWritePlan {
  mutationKind: EditorialMutationKind;
  actorUserId: string;
  postId: string | null;
  revisionNumber: number;
  fromStatus: BlogPostStatus;
  toStatus: BlogPostStatus;
  featureFlag: typeof EDITORIAL_SUPABASE_WRITES_ENABLED;
  executionMode: typeof EDITORIAL_SUPABASE_WRITE_MODE;
  executable: false;
  steps: SupabaseEditorialWriteStep[];
  unresolvedReferences: Array<"category_id" | "author_id" | "tag_ids">;
  blockingReason:
    | "BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF"
    | "BLOG_CLIENT_CONTRACT_REJECTED";
}

export interface NormalizedEditorialWriteError {
  code: string;
  category: "auth" | "rls" | "workflow" | "constraint" | "conflict" | "unknown";
  retryable: boolean;
  message: string;
  source: "supabase" | "postgres" | "blog_trigger" | "unknown";
}

const TRIGGER_ERRORS: Record<string, string> = {
  BLOG_INITIAL_STATUS_MUST_BE_DRAFT: "Novos artigos devem começar como draft.",
  BLOG_EDITORIAL_WRITE_FORBIDDEN: "Seu papel editorial não permite esta alteração.",
  BLOG_AUTHOR_PROFILE_REQUIRED: "O papel de autor exige um perfil de autoria vinculado.",
  BLOG_AUTHOR_ID_MUST_MATCH_EDITORIAL_MEMBER: "O autor do artigo deve corresponder ao perfil editorial vinculado.",
  BLOG_INVALID_STATUS_TRANSITION: "A transição de workflow solicitada não é permitida.",
  BLOG_CURRENT_REVISION_REQUIRES_APPROVAL: "A revisão atual precisa de aprovação válida antes desta ação.",
  BLOG_SCHEDULED_PUBLICATION_NOT_DUE: "O horário agendado para publicação ainda não chegou.",
  BLOG_PUBLISHED_CONTENT_REQUIRES_REVIEW_TRANSITION: "Conteúdo publicado deve voltar ao fluxo de revisão antes de ser alterado.",
  BLOG_SCHEDULE_REQUIRES_SCHEDULED_AT: "Informe uma data de agendamento.",
  BLOG_SCHEDULE_MUST_BE_FUTURE: "O agendamento precisa estar no futuro.",
  BLOG_PUBLISHING_REQUIREMENTS_NOT_MET: "O artigo ainda não atende aos requisitos mínimos para publicação.",
  BLOG_REVIEW_AUTH_REQUIRED: "A decisão de revisão exige uma sessão autenticada.",
  BLOG_REVIEW_REQUIRES_REVIEW_STATUS: "A decisão de revisão exige que o artigo esteja em revisão.",
  BLOG_REVISION_NOT_FOUND: "A revisão atual não foi encontrada.",
  BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN: "Quem criou a revisão não pode revisar a própria revisão.",
};

/**
 * Converts a repository-only mutation envelope into the exact *shape* of the
 * Supabase writes that a future phase would need. This function never performs
 * network I/O and never imports the Supabase client.
 */
export function planSupabaseEditorialWrite(mutation: EditorialMutationEnvelope): SupabaseEditorialWritePlan {
  const steps = mapMutationToSteps(mutation);
  const unresolvedReferences = collectUnresolvedReferences(mutation);
  const clientAllowed = mutation.clientPlan.allowedByClientContract;

  return {
    mutationKind: mutation.kind,
    actorUserId: mutation.actorUserId,
    postId: mutation.target.postId,
    revisionNumber: mutation.target.revisionNumber,
    fromStatus: mutation.target.fromStatus,
    toStatus: mutation.target.toStatus,
    featureFlag: EDITORIAL_SUPABASE_WRITES_ENABLED,
    executionMode: EDITORIAL_SUPABASE_WRITE_MODE,
    executable: false,
    steps,
    unresolvedReferences,
    blockingReason: clientAllowed
      ? "BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF"
      : "BLOG_CLIENT_CONTRACT_REJECTED",
  };
}

/**
 * Final fail-closed barrier for Phase 3-O. Even a valid write plan cannot cross
 * this boundary while the hard-coded feature flag is OFF.
 */
export async function executeSupabaseEditorialWrite(_plan: SupabaseEditorialWritePlan): Promise<never> {
  throw new Error("BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF");
}

export function normalizeEditorialWriteError(error: unknown): NormalizedEditorialWriteError {
  const candidate = asErrorCandidate(error);
  const message = candidate.message || "Falha editorial não identificada.";
  const triggerCode = Object.keys(TRIGGER_ERRORS).find((code) => message.includes(code));

  if (triggerCode) {
    return {
      code: triggerCode,
      category: "workflow",
      retryable: false,
      message: TRIGGER_ERRORS[triggerCode],
      source: "blog_trigger",
    };
  }

  if (candidate.code === "42501" || /row-level security|rls/i.test(message)) {
    return {
      code: candidate.code || "BLOG_RLS_FORBIDDEN",
      category: "rls",
      retryable: false,
      message: "A política de segurança do banco recusou esta operação editorial.",
      source: "postgres",
    };
  }

  if (candidate.code === "23505") {
    return {
      code: "23505",
      category: "conflict",
      retryable: false,
      message: "Já existe um registro editorial com uma chave única equivalente.",
      source: "postgres",
    };
  }

  if (candidate.code && candidate.code.startsWith("23")) {
    return {
      code: candidate.code,
      category: "constraint",
      retryable: false,
      message: "Uma constraint do banco recusou os dados editoriais.",
      source: "postgres",
    };
  }

  if (/jwt|auth|session|not authenticated/i.test(message)) {
    return {
      code: candidate.code || "BLOG_AUTH_REQUIRED",
      category: "auth",
      retryable: false,
      message: "A sessão editorial não é válida para esta operação.",
      source: "supabase",
    };
  }

  return {
    code: candidate.code || "BLOG_WRITE_UNKNOWN_ERROR",
    category: "unknown",
    retryable: false,
    message: "Não foi possível concluir a operação editorial.",
    source: "unknown",
  };
}

function mapMutationToSteps(mutation: EditorialMutationEnvelope): SupabaseEditorialWriteStep[] {
  switch (mutation.kind) {
    case "createDraft":
      return [
        {
          table: "blog_posts",
          operation: "insert",
          values: draftValues(mutation.payload as DraftMutationPayload, "draft"),
          note: "Futuro INSERT do draft. created_by/updated_by/revision são autoridades do trigger.",
        },
        {
          table: "blog_post_tags",
          operation: "replace_tags",
          note: "Futura sincronização de tags após resolução dos tag_ids.",
        },
      ];
    case "updateDraft":
      return [
        {
          table: "blog_posts",
          operation: "update",
          where: postWhere(mutation),
          values: draftValues(mutation.payload as DraftMutationPayload, mutation.target.toStatus),
          note: "Futuro UPDATE do conteúdo. revision_number é controlado pelo trigger.",
        },
        {
          table: "blog_post_tags",
          operation: "replace_tags",
          where: postWhere(mutation),
          note: "Futura sincronização transacional das tags.",
        },
      ];
    case "submitReview":
    case "returnToDraft":
    case "publishPost":
    case "archivePost":
    case "restoreDraft":
      return [statusStep(mutation, mutation.payload as StatusMutationPayload)];
    case "schedulePost":
      return [
        {
          table: "blog_posts",
          operation: "update",
          where: postWhere(mutation),
          values: {
            status: mutation.target.toStatus,
            scheduled_at: (mutation.payload as SchedulePayload).scheduledAt,
          },
          note: "Futuro UPDATE de agendamento; trigger valida aprovação e data futura.",
        },
      ];
    case "recordReviewDecision":
      return [
        {
          table: "blog_post_reviews",
          operation: "insert_review",
          values: {
            post_id: mutation.target.postId,
            revision_number: (mutation.payload as ReviewDecisionPayload).revisionNumber,
            decision: (mutation.payload as ReviewDecisionPayload).decision,
            notes: (mutation.payload as ReviewDecisionPayload).notes || null,
          },
          note: "Futuro INSERT de decisão; reviewer_user_id e revisão corrente são validados pelo trigger.",
        },
      ];
  }
}

function statusStep(mutation: EditorialMutationEnvelope, payload: StatusMutationPayload): SupabaseEditorialWriteStep {
  return {
    table: "blog_posts",
    operation: "update",
    where: postWhere(mutation),
    values: { status: mutation.target.toStatus },
    note: `${payload.note} O trigger permanece autoridade da transição.`,
  };
}

function postWhere(mutation: EditorialMutationEnvelope) {
  return {
    id: mutation.target.postId ?? "__NEW_POST__",
    revision_number: mutation.target.revisionNumber,
  };
}

function draftValues(payload: DraftMutationPayload, status: BlogPostStatus): Record<string, unknown> {
  return {
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    content: payload.content,
    status,
    category_id: "__RESOLVE_BY_CATEGORY__",
    author_id: "__RESOLVE_BY_AUTHOR__",
    featured_image_path: payload.featuredImagePath || null,
    featured_image_alt: payload.featuredImageAlt || null,
    meta_title: payload.metaTitle || null,
    meta_description: payload.metaDescription || null,
    focus_keyword: payload.focusKeyword || null,
    reading_time_minutes: payload.readingTimeMinutes,
  };
}

function collectUnresolvedReferences(mutation: EditorialMutationEnvelope): Array<"category_id" | "author_id" | "tag_ids"> {
  if (mutation.kind !== "createDraft" && mutation.kind !== "updateDraft") return [];
  return ["category_id", "author_id", "tag_ids"];
}

function asErrorCandidate(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== "object") return { code: "", message: String(error ?? "") };
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : "",
    message: typeof record.message === "string" ? record.message : "",
  };
}
