import { normalizeBlogParagraph } from "./blog-content";
import type { BlogPostStatus } from "./types";
import type {
  EditorialActor,
  EditorialCommandKind,
  EditorialCommandPlan,
  EditorialEditorForm,
  EditorialReviewDecision,
} from "./editorial-workflow";
import { planEditorialCommand } from "./editorial-workflow";

export const EDITORIAL_MUTATION_EXECUTION = "disabled_repository_only" as const;

export type EditorialMutationKind =
  | "createDraft"
  | "updateDraft"
  | "submitReview"
  | "recordReviewDecision"
  | "returnToDraft"
  | "schedulePost"
  | "publishPost"
  | "archivePost"
  | "restoreDraft";

export interface EditorialMutationTarget {
  postId: string | null;
  revisionNumber: number;
  fromStatus: BlogPostStatus;
  toStatus: BlogPostStatus;
}

export interface EditorialMutationEnvelope<TPayload = unknown> {
  kind: EditorialMutationKind;
  actorUserId: string;
  actorRole: EditorialActor["role"];
  target: EditorialMutationTarget;
  payload: TPayload;
  clientPlan: EditorialCommandPlan;
  execution: typeof EDITORIAL_MUTATION_EXECUTION;
  executable: false;
  reason: "BLOG_MUTATION_EXECUTION_DISABLED_REPOSITORY_ONLY";
}

export interface DraftMutationPayload {
  slug: string;
  title: string;
  excerpt: string;
  content: EditorialEditorForm["sections"];
  category: string;
  author: string;
  tags: string[];
  featuredImagePath: string;
  featuredImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  readingTimeMinutes: number;
}

export interface ReviewDecisionPayload {
  decision: EditorialReviewDecision;
  notes: string;
  revisionNumber: number;
}

export interface SchedulePayload {
  scheduledAt: string;
  revisionNumber: number;
}

export interface StatusMutationPayload {
  revisionNumber: number;
  note: string;
}

export function createDraft(actor: EditorialActor, form: EditorialEditorForm): EditorialMutationEnvelope<DraftMutationPayload> {
  const draftForm: EditorialEditorForm = {
    ...form,
    id: null,
    status: "draft",
    createdByUserId: actor.userId,
    revisionNumber: 1,
    latestReviewDecision: null,
    latestReviewerUserId: null,
    scheduledAt: "",
    publishedAt: "",
  };
  const plan = planEditorialCommand(actor, draftForm, "save_draft");
  return envelope("createDraft", actor, draftForm, plan, draftPayload(draftForm));
}

export function updateDraft(actor: EditorialActor, form: EditorialEditorForm): EditorialMutationEnvelope<DraftMutationPayload> {
  const plan = planEditorialCommand(actor, form, "save_draft");
  return envelope("updateDraft", actor, form, plan, draftPayload(form));
}

export function submitReview(actor: EditorialActor, form: EditorialEditorForm): EditorialMutationEnvelope<StatusMutationPayload> {
  return statusEnvelope("submitReview", actor, form, "submit_review", "Enviar revisão atual para avaliação.");
}

export function recordReviewDecision(
  actor: EditorialActor,
  form: EditorialEditorForm,
  decision: EditorialReviewDecision,
  notes = "",
): EditorialMutationEnvelope<ReviewDecisionPayload> {
  const command: EditorialCommandKind = decision === "approved" ? "approve_revision" : "request_changes";
  const plan = planEditorialCommand(actor, form, command);
  return envelope("recordReviewDecision", actor, form, plan, {
    decision,
    notes: notes.trim(),
    revisionNumber: form.revisionNumber,
  });
}

export function returnToDraft(actor: EditorialActor, form: EditorialEditorForm): EditorialMutationEnvelope<StatusMutationPayload> {
  return statusEnvelope("returnToDraft", actor, form, "return_to_draft", "Retornar artigo em revisão para draft.");
}

export function schedulePost(actor: EditorialActor, form: EditorialEditorForm, now = new Date()): EditorialMutationEnvelope<SchedulePayload> {
  const plan = planEditorialCommand(actor, form, "schedule", now);
  return envelope("schedulePost", actor, form, plan, {
    scheduledAt: form.scheduledAt,
    revisionNumber: form.revisionNumber,
  });
}

export function publishPost(actor: EditorialActor, form: EditorialEditorForm, now = new Date()): EditorialMutationEnvelope<StatusMutationPayload> {
  const plan = planEditorialCommand(actor, form, "publish", now);
  return envelope("publishPost", actor, form, plan, {
    revisionNumber: form.revisionNumber,
    note: "Publicar somente após aprovação válida da revisão corrente.",
  });
}

export function archivePost(actor: EditorialActor, form: EditorialEditorForm): EditorialMutationEnvelope<StatusMutationPayload> {
  return statusEnvelope("archivePost", actor, form, "archive", "Arquivar sem exclusão física do artigo.");
}

export function restoreDraft(actor: EditorialActor, form: EditorialEditorForm): EditorialMutationEnvelope<StatusMutationPayload> {
  return statusEnvelope("restoreDraft", actor, form, "restore_draft", "Restaurar artigo arquivado para draft.");
}

/**
 * Hard barrier for Phase 3-N. There is deliberately no Supabase client in this
 * module. Calling this function is proof that a caller attempted to cross the
 * repository-only boundary and therefore always fails closed.
 */
export async function executeEditorialMutation(_mutation: EditorialMutationEnvelope): Promise<never> {
  throw new Error("BLOG_MUTATION_EXECUTION_DISABLED_REPOSITORY_ONLY");
}

function statusEnvelope(
  kind: EditorialMutationKind,
  actor: EditorialActor,
  form: EditorialEditorForm,
  command: EditorialCommandKind,
  note: string,
): EditorialMutationEnvelope<StatusMutationPayload> {
  const plan = planEditorialCommand(actor, form, command);
  return envelope(kind, actor, form, plan, { revisionNumber: form.revisionNumber, note });
}

function envelope<TPayload>(
  kind: EditorialMutationKind,
  actor: EditorialActor,
  form: EditorialEditorForm,
  clientPlan: EditorialCommandPlan,
  payload: TPayload,
): EditorialMutationEnvelope<TPayload> {
  return {
    kind,
    actorUserId: actor.userId,
    actorRole: actor.role,
    target: {
      postId: form.id,
      revisionNumber: form.revisionNumber,
      fromStatus: clientPlan.fromStatus,
      toStatus: clientPlan.toStatus,
    },
    payload,
    clientPlan,
    execution: EDITORIAL_MUTATION_EXECUTION,
    executable: false,
    reason: "BLOG_MUTATION_EXECUTION_DISABLED_REPOSITORY_ONLY",
  };
}

function draftPayload(form: EditorialEditorForm): DraftMutationPayload {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    excerpt: form.excerpt.trim(),
    content: form.sections.map((section) => ({
      heading: section.heading.trim(),
      paragraphs: section.paragraphs.map(normalizeBlogParagraph).filter((paragraph): paragraph is NonNullable<typeof paragraph> => Boolean(paragraph)),
    })),
    category: form.category.trim(),
    author: form.author.trim(),
    tags: form.tags.map((tag) => tag.trim()).filter(Boolean),
    featuredImagePath: form.featuredImagePath.trim(),
    featuredImageAlt: form.featuredImageAlt.trim(),
    metaTitle: form.metaTitle.trim(),
    metaDescription: form.metaDescription.trim(),
    focusKeyword: form.focusKeyword.trim(),
    readingTimeMinutes: form.readingTimeMinutes,
  };
}
