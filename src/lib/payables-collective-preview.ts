/**
 * Pure preview calculations for collective payables editing.
 * No database writes. Server RPC must independently validate and recompute.
 */
export type PayablePreviewRow = {
  id: string;
  index: number;
  dueDate: string;
  amount: number;
  status: "pendente" | "atrasado" | "pago" | "cancelado";
  paidAmount: number;
  paidAt?: string | null;
  recurrence?: 'mensal' | 'semanal' | 'nenhuma';
};
export type CollectiveScope = "single" | "future" | "all";

function parseISODate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Data inválida");
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Data inválida");
  }
  return { year, month, day };
}

/** Keep the chosen day-of-month; clamp to last day for shorter months. */
export function monthlyDueDate(anchorISO: string, offsetMonths: number): string {
  const { year, month, day } = parseISODate(anchorISO);
  if (!Number.isInteger(offsetMonths)) throw new Error("Intervalo mensal inválido");
  const first = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function weeklyDueDate(anchorISO: string, offsetWeeks: number): string {
  const { year, month, day } = parseISODate(anchorISO);
  if (!Number.isInteger(offsetWeeks)) throw new Error("Intervalo semanal inválido");
  return new Date(Date.UTC(year,month-1,day+offsetWeeks*7)).toISOString().slice(0,10);
}

function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Valor inválido");
  const rounded = Math.round(value * 100);
  if (Math.abs(value * 100 - rounded) > 1e-6) throw new Error("Valor exige no máximo duas casas decimais");
  return rounded;
}

export function previewCollectiveEdit(
  rows: PayablePreviewRow[],
  selectedIndex: number,
  scope: CollectiveScope,
  newAmount: number,
  selectedDueDate: string,
) {
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1) throw new Error("Parcela inválida");
  const nextCents = cents(newAmount);
  if (nextCents <= 0) throw new Error("O valor precisa ser positivo");
  parseISODate(selectedDueDate);
  const cadence = rows[0]?.recurrence ?? 'mensal';
  if (!['mensal','semanal'].includes(cadence) || rows.some(row => (row.recurrence ?? 'mensal') !== cadence)) throw new Error('Recorrência inconsistente');
  const selected = rows.filter((row) =>
    (scope === "all" || row.index >= selectedIndex) &&
    (scope !== "single" || row.index === selectedIndex) &&
    (row.status === "pendente" || row.status === "atrasado") &&
    cents(row.paidAmount) === 0 && !row.paidAt
  ).sort((a, b) => a.index - b.index);
  if (!selected.some((row) => row.index === selectedIndex)) {
    throw new Error("A parcela selecionada não está pendente e integralmente em aberto");
  }
  const beforeCents = selected.reduce((sum, row) => sum + cents(row.amount), 0);
  const afterCents = selected.length * nextCents;
  return {
    count: selected.length,
    before: beforeCents / 100,
    after: afterCents / 100,
    difference: (afterCents - beforeCents) / 100,
    changes: selected.map((row) => ({
      id: row.id,
      index: row.index,
      previousAmount: row.amount,
      nextAmount: nextCents / 100,
      previousDueDate: row.dueDate,
      nextDueDate: cadence === 'semanal' ? weeklyDueDate(selectedDueDate, row.index - selectedIndex) : monthlyDueDate(selectedDueDate, row.index - selectedIndex),
    })),
  };
}

/**
 * Read-only confirmation payload for the future transactional RPC.
 * The server must revalidate all rows under lock before writing.
 */
export function prepareCollectiveConfirmation(
  seriesId: string | null,
  selectedPayableId: string,
  scope: CollectiveScope,
  preview: ReturnType<typeof previewCollectiveEdit>,
) {
  if (!seriesId) throw new Error("Série sem identificador persistente. Edição coletiva bloqueada.");
  if (!selectedPayableId || !preview.changes.some((row) => row.id === selectedPayableId)) {
    throw new Error("A parcela selecionada não consta na prévia.");
  }
  const expectedIds = preview.changes.map((row) => row.id);
  if (new Set(expectedIds).size !== expectedIds.length) throw new Error("Parcela duplicada na prévia.");
  return {
    seriesId,
    selectedPayableId,
    scope,
    expectedIds,
    count: preview.count,
    before: preview.before,
    after: preview.after,
    difference: preview.difference,
    changes: preview.changes,
  };
}

/**
 * Canonical snapshot of EVERY row of the persisted series, including settled rows.
 * Mirrors the RPC's jsonb_agg(jsonb_build_object(... ORDER BY series_index)).
 * Dates and numeric amounts must come from a fresh authenticated DB read.
 */
export function createCollectiveSnapshot(rows: Array<{
  id: string; series_index: number; amount: number; due_date: string;
  status: string; paid_amount: number; paid_at: string | null;
}>) {
  const ordered = [...rows].sort((a,b) => a.series_index-b.series_index);
  if (new Set(ordered.map(r=>r.series_index)).size !== ordered.length) {
    throw new Error("Série inconsistente: índices duplicados");
  }
  return ordered.map(r=>({
    id:r.id, amount:r.amount, due_date:r.due_date,
    status:r.status, paid_amount:r.paid_amount, paid_at:r.paid_at,
  }));
}
