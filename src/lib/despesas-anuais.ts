// Helpers puros compartilhados entre a matriz de Despesas Anuais e a
// Totalização Personalizada. Não alterar as regras sem revisar ambos os usos.

export type DespesaPayable = {
  id: string;
  supplier_id: string | null;
  description: string;
  category: string;
  amount: number;
  due_date: string;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  paid_amount: number | null;
  paid_at: string | null;
  suppliers?: { name: string } | null;
};

/** Regra oficial: pago usa paid_amount (fallback amount); demais usam amount. */
export function getAnnualExpenseValue(p: DespesaPayable): number {
  if (p.status === "cancelado") return 0;
  const raw = p.status === "pago" ? (p.paid_amount ?? p.amount) : p.amount;
  return Number(raw) || 0;
}

/** Cancelados são excluídos integralmente dos cálculos. */
export function isAnnualExpenseIncluded(p: DespesaPayable): boolean {
  return p.status !== "cancelado";
}

/**
 * Índice da coluna 0..12 dentro da janela de 13 meses
 * (Jan..Dez do ano-base + Jan do ano seguinte). Retorna -1 fora da janela.
 */
export function getAnnualExpenseMonthIndex(p: DespesaPayable, year: number): number {
  const d = new Date(p.due_date + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  if (y === year) return m;
  if (y === year + 1 && m === 0) return 12;
  return -1;
}
