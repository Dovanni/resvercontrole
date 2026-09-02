import type { EditorialMutationEnvelope } from "./editorial-mutations";
import {
  EDITORIAL_SUPABASE_WRITE_MODE,
  EDITORIAL_SUPABASE_WRITES_ENABLED,
  type SupabaseEditorialWritePlan,
  planSupabaseEditorialWrite,
} from "./editorial-supabase-write.adapter";

export interface EditorialReferenceRecord {
  id: string;
  slug: string;
  name: string;
  active: boolean;
}

export interface EditorialAuthorReferenceRecord {
  id: string;
  slug: string;
  displayName: string;
  active: boolean;
}

export interface EditorialReferenceCatalog {
  categories: EditorialReferenceRecord[];
  authors: EditorialAuthorReferenceRecord[];
  tags: EditorialReferenceRecord[];
}

export interface ResolvedEditorialReferences {
  categoryId: string;
  authorId: string;
  tagIds: string[];
}

export type EditorialReferenceIssueCode =
  | "BLOG_CATEGORY_REFERENCE_NOT_FOUND"
  | "BLOG_CATEGORY_REFERENCE_AMBIGUOUS"
  | "BLOG_AUTHOR_REFERENCE_NOT_FOUND"
  | "BLOG_AUTHOR_REFERENCE_AMBIGUOUS"
  | "BLOG_TAG_REFERENCE_NOT_FOUND"
  | "BLOG_TAG_REFERENCE_AMBIGUOUS";

export interface EditorialReferenceIssue {
  code: EditorialReferenceIssueCode;
  value: string;
  message: string;
}

export interface EditorialReferenceResolution {
  resolved: ResolvedEditorialReferences | null;
  issues: EditorialReferenceIssue[];
}

export type EditorialTransactionOperation =
  | "insert_post"
  | "update_post_optimistic"
  | "insert_review"
  | "delete_post_tags"
  | "insert_post_tags";

export interface EditorialTransactionStep {
  order: number;
  operation: EditorialTransactionOperation;
  table: "blog_posts" | "blog_post_reviews" | "blog_post_tags";
  where?: Record<string, string | number>;
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  expectedAffectedRows?: number | "one_or_more";
  note: string;
}

export interface EditorialTransactionPlan {
  mutationKind: EditorialMutationEnvelope["kind"];
  featureFlag: typeof EDITORIAL_SUPABASE_WRITES_ENABLED;
  executionMode: typeof EDITORIAL_SUPABASE_WRITE_MODE;
  executable: false;
  atomic: true;
  isolationExpectation: "single_database_transaction";
  optimisticConcurrency: {
    enabled: boolean;
    expectedRevision: number | null;
    conflictCode: "BLOG_EDITORIAL_REVISION_CONFLICT";
  };
  referenceResolution: EditorialReferenceResolution;
  steps: EditorialTransactionStep[];
  blockingReasons: string[];
}

export function resolveEditorialReferences(
  mutation: EditorialMutationEnvelope,
  catalog: EditorialReferenceCatalog,
): EditorialReferenceResolution {
  if (mutation.kind !== "createDraft" && mutation.kind !== "updateDraft") {
    return { resolved: null, issues: [] };
  }

  const payload = mutation.payload as {
    category: string;
    author: string;
    tags: string[];
  };
  const issues: EditorialReferenceIssue[] = [];

  const category = resolveBySlugOrName(
    payload.category,
    catalog.categories.filter((item) => item.active),
    "category",
    issues,
  );
  const author = resolveAuthor(
    payload.author,
    catalog.authors.filter((item) => item.active),
    issues,
  );

  const tagIds: string[] = [];
  for (const rawTag of uniqueNormalized(payload.tags)) {
    const tag = resolveBySlugOrName(
      rawTag,
      catalog.tags.filter((item) => item.active),
      "tag",
      issues,
    );
    if (tag) tagIds.push(tag.id);
  }

  if (!category || !author || issues.length > 0) return { resolved: null, issues };
  return {
    resolved: {
      categoryId: category.id,
      authorId: author.id,
      tagIds: [...new Set(tagIds)].sort(),
    },
    issues: [],
  };
}

export function planEditorialTransaction(
  mutation: EditorialMutationEnvelope,
  catalog: EditorialReferenceCatalog,
): EditorialTransactionPlan {
  const writePlan = planSupabaseEditorialWrite(mutation);
  const referenceResolution = resolveEditorialReferences(mutation, catalog);
  const blockingReasons = collectBlockingReasons(writePlan, referenceResolution);
  const resolved = referenceResolution.resolved;
  const optimistic = mutation.kind !== "createDraft" && mutation.target.postId !== null;

  return {
    mutationKind: mutation.kind,
    featureFlag: EDITORIAL_SUPABASE_WRITES_ENABLED,
    executionMode: EDITORIAL_SUPABASE_WRITE_MODE,
    executable: false,
    atomic: true,
    isolationExpectation: "single_database_transaction",
    optimisticConcurrency: {
      enabled: optimistic,
      expectedRevision: optimistic ? mutation.target.revisionNumber : null,
      conflictCode: "BLOG_EDITORIAL_REVISION_CONFLICT",
    },
    referenceResolution,
    steps: buildTransactionSteps(mutation, writePlan, resolved),
    blockingReasons,
  };
}

export function assertOptimisticWriteResult(affectedRows: number): void {
  if (affectedRows !== 1) throw new Error("BLOG_EDITORIAL_REVISION_CONFLICT");
}

export async function executeEditorialTransaction(_plan: EditorialTransactionPlan): Promise<never> {
  throw new Error("BLOG_SUPABASE_WRITES_FEATURE_FLAG_OFF");
}

function buildTransactionSteps(
  mutation: EditorialMutationEnvelope,
  writePlan: SupabaseEditorialWritePlan,
  resolved: ResolvedEditorialReferences | null,
): EditorialTransactionStep[] {
  if (!mutation.clientPlan.allowedByClientContract) return [];

  if (mutation.kind === "createDraft") {
    const postStep = writePlan.steps.find((step) => step.table === "blog_posts");
    return [
      {
        order: 10,
        operation: "insert_post",
        table: "blog_posts",
        values: resolved ? replaceReferencePlaceholders(postStep?.values, resolved) : postStep?.values,
        expectedAffectedRows: 1,
        note: "Criar o draft e capturar seu UUID dentro da mesma transação futura.",
      },
      {
        order: 20,
        operation: "insert_post_tags",
        table: "blog_post_tags",
        values: resolved?.tagIds.map((tagId) => ({ post_id: "__INSERTED_POST_ID__", tag_id: tagId })) ?? [],
        expectedAffectedRows: resolved?.tagIds.length ? "one_or_more" : 0,
        note: "Associar tags já resolvidas ao UUID retornado pelo INSERT do post.",
      },
    ];
  }

  if (mutation.kind === "updateDraft") {
    const postStep = writePlan.steps.find((step) => step.table === "blog_posts");
    return [
      optimisticUpdateStep(mutation, resolved ? replaceReferencePlaceholders(postStep?.values, resolved) : postStep?.values),
      {
        order: 20,
        operation: "delete_post_tags",
        table: "blog_post_tags",
        where: { post_id: mutation.target.postId ?? "__MISSING_POST_ID__" },
        note: "Remover associações atuais somente após o UPDATE otimista do post ter sido confirmado.",
      },
      {
        order: 30,
        operation: "insert_post_tags",
        table: "blog_post_tags",
        values: resolved?.tagIds.map((tagId) => ({ post_id: mutation.target.postId, tag_id: tagId })) ?? [],
        expectedAffectedRows: resolved?.tagIds.length ? "one_or_more" : 0,
        note: "Recriar o conjunto canônico de tags dentro da mesma transação.",
      },
    ];
  }

  if (mutation.kind === "recordReviewDecision") {
    const reviewStep = writePlan.steps[0];
    return [{
      order: 10,
      operation: "insert_review",
      table: "blog_post_reviews",
      values: reviewStep?.values,
      expectedAffectedRows: 1,
      note: "Inserir a decisão da revisão; o trigger valida revisão corrente e four-eyes.",
    }];
  }

  const postStep = writePlan.steps.find((step) => step.table === "blog_posts");
  return [optimisticUpdateStep(mutation, postStep?.values)];
}

function optimisticUpdateStep(
  mutation: EditorialMutationEnvelope,
  values: Record<string, unknown> | undefined,
): EditorialTransactionStep {
  return {
    order: 10,
    operation: "update_post_optimistic",
    table: "blog_posts",
    where: {
      id: mutation.target.postId ?? "__MISSING_POST_ID__",
      revision_number: mutation.target.revisionNumber,
    },
    values,
    expectedAffectedRows: 1,
    note: "Se nenhuma linha corresponder ao id + revision_number esperado, abortar toda a transação com BLOG_EDITORIAL_REVISION_CONFLICT.",
  };
}

function replaceReferencePlaceholders(
  values: Record<string, unknown> | undefined,
  resolved: ResolvedEditorialReferences,
) {
  return {
    ...(values ?? {}),
    category_id: resolved.categoryId,
    author_id: resolved.authorId,
  };
}

function collectBlockingReasons(
  writePlan: SupabaseEditorialWritePlan,
  resolution: EditorialReferenceResolution,
) {
  const reasons = [writePlan.blockingReason];
  if (resolution.issues.length > 0) reasons.push("BLOG_EDITORIAL_REFERENCES_UNRESOLVED");
  return [...new Set(reasons)];
}

function resolveBySlugOrName(
  raw: string,
  records: EditorialReferenceRecord[],
  kind: "category" | "tag",
  issues: EditorialReferenceIssue[],
) {
  const needle = normalize(raw);
  const matches = records.filter((item) => normalize(item.slug) === needle || normalize(item.name) === needle);
  if (matches.length === 1) return matches[0];

  const prefix = kind === "category" ? "BLOG_CATEGORY_REFERENCE" : "BLOG_TAG_REFERENCE";
  issues.push({
    code: `${prefix}_${matches.length === 0 ? "NOT_FOUND" : "AMBIGUOUS"}` as EditorialReferenceIssueCode,
    value: raw,
    message: matches.length === 0
      ? `Nenhuma referência ativa foi encontrada para ${raw}.`
      : `Mais de uma referência ativa corresponde a ${raw}.`,
  });
  return null;
}

function resolveAuthor(
  raw: string,
  records: EditorialAuthorReferenceRecord[],
  issues: EditorialReferenceIssue[],
) {
  const needle = normalize(raw);
  const matches = records.filter((item) => normalize(item.slug) === needle || normalize(item.displayName) === needle);
  if (matches.length === 1) return matches[0];

  issues.push({
    code: matches.length === 0 ? "BLOG_AUTHOR_REFERENCE_NOT_FOUND" : "BLOG_AUTHOR_REFERENCE_AMBIGUOUS",
    value: raw,
    message: matches.length === 0
      ? `Nenhum autor ativo foi encontrado para ${raw}.`
      : `Mais de um autor ativo corresponde a ${raw}.`,
  });
  return null;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
