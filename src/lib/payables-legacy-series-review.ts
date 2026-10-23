/**
 * CP-04: reconciliation of legacy installments in an isolated review flow.
 * NEVER infer a persisted series identity from a description such as "(1/17)".
 * This module is pure: it neither reads nor writes Supabase.
 */
export type LegacyPayable = {
  id: string;
  empresa_id: string;
  user_id: string;
  description: string;
  series_id?: string | null;
  status: string;
  paid_amount: number;
  paid_at?: string | null;
};

export type ReviewedLegacySeries = {
  empresaId: string;
  userId: string;
  /** Complete, explicitly reviewed ordered IDs; position 1 is installment 1. */
  orderedIds: readonly string[];
};

export type ReconciliationPlan = {
  empresaId: string;
  userId: string;
  orderedIds: string[];
  total: number;
  /** Assign a random UUID at persistence time, NOT derived from description. */
  requiresNewSeriesId: true;
};

export function prepareReviewedLegacySeries(
  rows: readonly LegacyPayable[],
  review: ReviewedLegacySeries,
): ReconciliationPlan {
  const ids = [...review.orderedIds];
  if (!review.empresaId || !review.userId || ids.length < 2 || ids.length > 120) {
    throw new Error("Revisão incompleta ou quantidade inválida.");
  }
  if (new Set(ids).size !== ids.length) throw new Error("IDs repetidos na revisão.");
  const byId = new Map(rows.map(row => [row.id, row]));
  if (byId.size !== rows.length) throw new Error("IDs duplicados na origem.");
  const total = ids.length;
  // Duplicate installment labels within the tenant are ambiguous even when
  // the reviewer selected IDs: do not silently mix separate obligations.
  const selected = ids.map(id => byId.get(id));
  for (const row of selected) {
    if (!row) continue;
    const matches = rows.filter(candidate =>
      candidate.empresa_id === review.empresaId &&
      candidate.user_id === review.userId &&
      candidate.description.trim() === row.description.trim() &&
      !candidate.series_id,
    );
    if (matches.length !== 1) {
      throw new Error("Numeração ambígua entre obrigações; conciliação automática bloqueada.");
    }
  }
  for (const [position, id] of ids.entries()) {
    const row = byId.get(id);
    if (!row || row.empresa_id !== review.empresaId || row.user_id !== review.userId) {
      throw new Error("Parcela inexistente ou fora da empresa/usuário.");
    }
    if (row.series_id) throw new Error("Parcela já vinculada a uma série.");
    const match = /\((\d+)\/(\d+)\)\s*$/.exec(row.description);
    if (!match || Number(match[1]) !== position + 1 || Number(match[2]) !== total) {
      throw new Error("Numeração inconsistente; exige revisão manual.");
    }
  }
  return {
    empresaId: review.empresaId,
    userId: review.userId,
    orderedIds: ids,
    total,
    requiresNewSeriesId: true,
  };
}
