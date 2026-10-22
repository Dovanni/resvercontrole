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
  const selected = rows.filter((row) =>
    (scope === "all" || row.index >= selectedIndex) &&
    (scope !== "single" || row.index === selectedIndex) &&
    (row.status === "pendente" || row.status === "atrasado") &&
    cents(row.paidAmount) === 0
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
      nextDueDate: monthlyDueDate(selectedDueDate, row.index - selectedIndex),
    })),
  };
}
