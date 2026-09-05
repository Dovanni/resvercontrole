import { validateStructuredBlogLinks } from "./blog-content";
import type { BlogArticle, BlogArticleParagraph, BlogArticleSection, BlogPostStatus } from "./types";
import type { EditorialRole } from "./blog.repository";

export type EditorialReviewDecision = "approved" | "changes_requested";

export type EditorialCommandKind =
  | "save_draft"
  | "submit_review"
  | "request_changes"
  | "approve_revision"
  | "return_to_draft"
  | "schedule"
  | "publish"
  | "archive"
  | "restore_draft";

export interface EditorialEditorForm {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  sections: BlogArticleSection[];
  category: string;
  author: string;
  tags: string[];
  featuredImagePath: string;
  featuredImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  readingTimeMinutes: number;
  status: BlogPostStatus;
  revisionNumber: number;
  scheduledAt: string;
  publishedAt: string;
  createdByUserId: string | null;
  latestReviewDecision: EditorialReviewDecision | null;
  latestReviewerUserId: string | null;
}

export interface EditorialActor {
  userId: string;
  role: EditorialRole;
  authorId: string | null;
}

export interface EditorialValidationIssue {
  field: keyof EditorialEditorForm | "workflow";
  code: string;
  message: string;
}

export interface EditorialCommandPlan {
  command: EditorialCommandKind;
  fromStatus: BlogPostStatus;
  toStatus: BlogPostStatus;
  allowedByClientContract: boolean;
  persistence: "disabled_repository_only";
  issues: EditorialValidationIssue[];
  note: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function articleToEditorialForm(article: BlogArticle): EditorialEditorForm {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    sections: article.sections.map((section) => ({ ...section, paragraphs: [...section.paragraphs] })),
    category: article.category,
    author: article.author,
    tags: [...article.tags],
    featuredImagePath: article.featuredImage ?? "",
    featuredImageAlt: article.featuredImageAlt,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    focusKeyword: article.focusKeyword,
    readingTimeMinutes: article.readingTimeMinutes,
    status: article.status,
    revisionNumber: 1,
    scheduledAt: "",
    publishedAt: article.status === "published" ? article.publishedAt : "",
    createdByUserId: null,
    latestReviewDecision: null,
    latestReviewerUserId: null,
  };
}

export function createEmptyEditorialForm(): EditorialEditorForm {
  return {
    id: null,
    slug: "",
    title: "",
    excerpt: "",
    sections: [{ heading: "", paragraphs: [""] }],
    category: "",
    author: "",
    tags: [],
    featuredImagePath: "",
    featuredImageAlt: "",
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
    readingTimeMinutes: 1,
    status: "draft",
    revisionNumber: 1,
    scheduledAt: "",
    publishedAt: "",
    createdByUserId: null,
    latestReviewDecision: null,
    latestReviewerUserId: null,
  };
}

export function validateEditorialDraft(form: EditorialEditorForm): EditorialValidationIssue[] {
  const issues: EditorialValidationIssue[] = [];
  if (!form.slug.trim()) issues.push(issue("slug", "BLOG_SLUG_REQUIRED", "Informe o slug."));
  else if (!SLUG_PATTERN.test(form.slug)) issues.push(issue("slug", "BLOG_SLUG_INVALID", "Use apenas letras minúsculas, números e hífens."));
  if (!form.title.trim()) issues.push(issue("title", "BLOG_TITLE_REQUIRED", "Informe o título."));
  if (!form.excerpt.trim()) issues.push(issue("excerpt", "BLOG_EXCERPT_REQUIRED", "Informe o resumo."));
  if (!Number.isInteger(form.readingTimeMinutes) || form.readingTimeMinutes <= 0) {
    issues.push(issue("readingTimeMinutes", "BLOG_READING_TIME_INVALID", "O tempo de leitura deve ser um inteiro maior que zero."));
  }
  const linkIssue = validateStructuredBlogLinks(form.sections);
  if (linkIssue === "BLOG_LINK_TEXT_REQUIRED") issues.push(issue("sections", linkIssue, "Todo link precisa ter um texto visível."));
  if (linkIssue === "BLOG_LINK_INVALID_HREF") issues.push(issue("sections", linkIssue, "Use apenas links internos iniciados por / ou URLs HTTPS."));
  return issues;
}

export function validateEditorialPublishingRequirements(form: EditorialEditorForm): EditorialValidationIssue[] {
  const issues = validateEditorialDraft(form);
  if (!form.category.trim()) issues.push(issue("category", "BLOG_CATEGORY_REQUIRED", "Selecione uma categoria antes de publicar."));
  if (!form.author.trim()) issues.push(issue("author", "BLOG_AUTHOR_REQUIRED", "Selecione um autor antes de publicar."));
  if (!form.metaTitle.trim()) issues.push(issue("metaTitle", "BLOG_META_TITLE_REQUIRED", "Informe o meta title antes de publicar."));
  if (!form.metaDescription.trim()) issues.push(issue("metaDescription", "BLOG_META_DESCRIPTION_REQUIRED", "Informe a meta description antes de publicar."));
  if (!form.featuredImageAlt.trim()) issues.push(issue("featuredImageAlt", "BLOG_IMAGE_ALT_REQUIRED", "Informe o texto alternativo da imagem."));
  if (!form.focusKeyword.trim()) issues.push(issue("focusKeyword", "BLOG_FOCUS_KEYWORD_REQUIRED", "Informe a palavra-chave principal."));
  if (!hasStructuredContent(form.sections)) issues.push(issue("sections", "BLOG_CONTENT_REQUIRED", "Inclua pelo menos uma seção com título e parágrafo."));
  return issues;
}

export function canEditEditorialDraft(actor: EditorialActor, form: EditorialEditorForm) {
  if (actor.role === "owner" || actor.role === "editor") return form.status !== "published";
  return actor.role === "author" && form.status === "draft" && form.createdByUserId === actor.userId;
}

export function availableEditorialCommands(actor: EditorialActor, form: EditorialEditorForm): EditorialCommandKind[] {
  const commands: EditorialCommandKind[] = [];
  const ownerOrEditor = actor.role === "owner" || actor.role === "editor";
  const authorOwnDraft = actor.role === "author" && form.status === "draft" && form.createdByUserId === actor.userId;

  if (form.status === "draft" && (ownerOrEditor || authorOwnDraft)) commands.push("save_draft", "submit_review");
  if (form.status === "review" && ["owner", "editor", "reviewer"].includes(actor.role)) commands.push("request_changes", "approve_revision");
  if (form.status === "review" && ownerOrEditor) commands.push("return_to_draft", "schedule", "publish", "archive");
  if (form.status === "scheduled" && ownerOrEditor) commands.push("publish", "archive");
  if (form.status === "published" && ownerOrEditor) commands.push("archive");
  if (form.status === "archived" && ownerOrEditor) commands.push("restore_draft");
  return commands;
}

export function planEditorialCommand(actor: EditorialActor, form: EditorialEditorForm, command: EditorialCommandKind, now = new Date()): EditorialCommandPlan {
  const allowedCommands = availableEditorialCommands(actor, form);
  const issues: EditorialValidationIssue[] = [];
  let toStatus = form.status;

  if (!allowedCommands.includes(command)) issues.push(issue("workflow", "BLOG_COMMAND_NOT_ALLOWED", "Este comando não é permitido para o papel e o status atuais."));

  switch (command) {
    case "save_draft":
      toStatus = "draft";
      issues.push(...validateEditorialDraft(form));
      break;
    case "submit_review":
      toStatus = "review";
      issues.push(...validateEditorialDraft(form));
      break;
    case "request_changes":
      toStatus = "review";
      if (form.status !== "review") issues.push(issue("workflow", "BLOG_REVIEW_STATUS_REQUIRED", "Solicitar ajustes exige status de revisão."));
      if (form.createdByUserId === actor.userId) issues.push(issue("workflow", "BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN", "Quem criou a revisão não pode revisar a própria revisão."));
      break;
    case "approve_revision":
      toStatus = "review";
      if (form.status !== "review") issues.push(issue("workflow", "BLOG_REVIEW_STATUS_REQUIRED", "Aprovação exige status de revisão."));
      if (form.createdByUserId === actor.userId) issues.push(issue("workflow", "BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN", "Quem criou a revisão não pode aprovar a própria revisão."));
      break;
    case "return_to_draft":
      toStatus = "draft";
      if (form.status !== "review") issues.push(issue("workflow", "BLOG_REVIEW_STATUS_REQUIRED", "Retornar para draft exige status de revisão."));
      break;
    case "schedule":
      toStatus = "scheduled";
      issues.push(...validateEditorialPublishingRequirements(form));
      requireCurrentApproval(form, issues);
      if (!form.scheduledAt) issues.push(issue("scheduledAt", "BLOG_SCHEDULE_REQUIRES_SCHEDULED_AT", "Informe uma data de agendamento."));
      else if (new Date(form.scheduledAt).getTime() <= now.getTime()) issues.push(issue("scheduledAt", "BLOG_SCHEDULE_MUST_BE_FUTURE", "O agendamento precisa estar no futuro."));
      break;
    case "publish":
      toStatus = "published";
      issues.push(...validateEditorialPublishingRequirements(form));
      requireCurrentApproval(form, issues);
      if (form.status === "scheduled" && form.scheduledAt && new Date(form.scheduledAt).getTime() > now.getTime()) issues.push(issue("scheduledAt", "BLOG_SCHEDULED_PUBLICATION_NOT_DUE", "O horário agendado ainda não foi alcançado."));
      break;
    case "archive":
      toStatus = "archived";
      break;
    case "restore_draft":
      toStatus = "draft";
      break;
  }

  return {
    command,
    fromStatus: form.status,
    toStatus,
    allowedByClientContract: issues.length === 0,
    persistence: "disabled_repository_only",
    issues: dedupeIssues(issues),
    note: "Fase 3-M: plano calculado somente em memória. Nenhuma mutação Supabase é executada.",
  };
}

export function simulateEditorialCommand(form: EditorialEditorForm, plan: EditorialCommandPlan): EditorialEditorForm {
  if (!plan.allowedByClientContract) return form;
  if (plan.command === "approve_revision") return { ...form, latestReviewDecision: "approved" };
  if (plan.command === "request_changes") return { ...form, latestReviewDecision: "changes_requested" };
  if (plan.command === "return_to_draft") return { ...form, status: "draft", latestReviewDecision: null, latestReviewerUserId: null, scheduledAt: "" };
  return { ...form, status: plan.toStatus, scheduledAt: plan.toStatus === "review" ? "" : form.scheduledAt };
}

function requireCurrentApproval(form: EditorialEditorForm, issues: EditorialValidationIssue[]) {
  if (form.latestReviewDecision !== "approved" || !form.latestReviewerUserId) issues.push(issue("workflow", "BLOG_CURRENT_REVISION_REQUIRES_APPROVAL", "A revisão atual precisa estar aprovada por outro usuário."));
}

function paragraphHasText(paragraph: BlogArticleParagraph) {
  if (typeof paragraph === "string") return paragraph.trim().length > 0;
  return paragraph.content.some((item) => item.text.trim().length > 0);
}

function hasStructuredContent(sections: BlogArticleSection[]) {
  return sections.some((section) => section.heading.trim().length > 0 && section.paragraphs.some(paragraphHasText));
}

function issue(field: EditorialValidationIssue["field"], code: string, message: string): EditorialValidationIssue {
  return { field, code, message };
}

function dedupeIssues(issues: EditorialValidationIssue[]) {
  const seen = new Set<string>();
  return issues.filter((current) => {
    const key = `${current.field}:${current.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
