import { describe, expect, it } from "vitest";
import { prepareReviewedLegacySeries, type LegacyPayable } from "./payables-legacy-series-review";

const rows: LegacyPayable[] = Array.from({ length: 3 }, (_, i) => ({
  id: String(i + 1), empresa_id: "empresa-a", user_id: "usuario-a",
  description: `Aluguel (${i + 1}/3)`, status: i === 1 ? "pago" : "pendente",
  paid_amount: i === 1 ? 100 : 0,
}));
const review = { empresaId: "empresa-a", userId: "usuario-a", orderedIds: ["1", "2", "3"] };

describe("CP-04 legacy series review — no database writes", () => {
  it("accepts only a complete, explicitly ordered series, including paid installments", () => {
    expect(prepareReviewedLegacySeries(rows, review)).toEqual({
      empresaId: "empresa-a", userId: "usuario-a", orderedIds: ["1", "2", "3"],
      total: 3, requiresNewSeriesId: true,
    });
  });
  it("rejects missing or duplicated installment IDs", () => {
    expect(() => prepareReviewedLegacySeries(rows, { ...review, orderedIds: ["1", "2"] })).toThrow();
    expect(() => prepareReviewedLegacySeries(rows, { ...review, orderedIds: ["1", "1", "3"] })).toThrow();
  });
  it("rejects mixing companies and users", () => {
    expect(() => prepareReviewedLegacySeries([...rows, { ...rows[0], id: "x", empresa_id: "empresa-b" }],
      { ...review, orderedIds: ["x", "2", "3"] })).toThrow();
    expect(() => prepareReviewedLegacySeries([...rows, { ...rows[0], id: "x", user_id: "usuario-b" }],
      { ...review, orderedIds: ["x", "2", "3"] })).toThrow();
  });
  it("rejects incorrect order and previously identified series", () => {
    expect(() => prepareReviewedLegacySeries(rows, { ...review, orderedIds: ["2", "1", "3"] })).toThrow();
    expect(() => prepareReviewedLegacySeries(rows.map(p => p.id === "2" ? { ...p, series_id: "existing" } : p), review)).toThrow();
  });
  it("does not merge two obligations with the same descriptions automatically", () => {
    const duplicates = rows.map(p => ({ ...p, id: "other-" + p.id }));
    expect(() => prepareReviewedLegacySeries([...rows, ...duplicates],
      { ...review, orderedIds: ["1", "other-2", "3"] })).toThrow(/ambígua/);
    // A reviewer must supply explicit IDs; matching text alone never creates a plan.
    expect(() => prepareReviewedLegacySeries([...rows, ...duplicates],
      { ...review, orderedIds: [] })).toThrow();
  });
});
