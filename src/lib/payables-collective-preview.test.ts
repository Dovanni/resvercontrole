import { describe, expect, it } from "vitest";
import { monthlyDueDate, previewCollectiveEdit, prepareCollectiveConfirmation, type PayablePreviewRow } from "./payables-collective-preview";

const rows: PayablePreviewRow[] = [
  { id: "a", index: 1, dueDate: "2026-01-31", amount: 94.47, status: "pendente", paidAmount: 0, recurrence: "mensal" },
  { id: "b", index: 2, dueDate: "2026-02-28", amount: 94.47, status: "pago", paidAmount: 94.47, recurrence: "mensal" },
  { id: "c", index: 3, dueDate: "2026-03-31", amount: 94.47, status: "pendente", paidAmount: 0, recurrence: "mensal" },
  { id: "d", index: 4, dueDate: "2026-04-30", amount: 94.47, status: "pendente", paidAmount: 10, recurrence: "mensal" },
  { id: "e", index: 5, dueDate: "2026-05-31", amount: 94.47, status: "cancelado", paidAmount: 0, recurrence: "mensal" },
];

describe("monthlyDueDate", () => {
  it("clamps February but restores day 31 in March", () => {
    expect(monthlyDueDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(monthlyDueDate("2026-01-31", 2)).toBe("2026-03-31");
  });
  it("handles leap years and negative month offsets", () => {
    expect(monthlyDueDate("2024-01-31", 1)).toBe("2024-02-29");
    expect(monthlyDueDate("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("rejects invalid calendar dates", () => {
    expect(() => monthlyDueDate("2026-02-30", 1)).toThrow();
  });
});

describe("previewCollectiveEdit", () => {
  it("previews future open installments only with cents-based totals", () => {
    const result = previewCollectiveEdit(rows, 1, "future", 100, "2026-01-31");
    expect(result.count).toBe(2);
    expect(result.before).toBe(188.94);
    expect(result.after).toBe(200);
    expect(result.difference).toBe(11.06);
    expect(result.changes.map(x => x.id)).toEqual(["a", "c"]);
    expect(result.changes[1].nextDueDate).toBe("2026-03-31");
  });
  it("previews a single installment", () => {
    expect(previewCollectiveEdit(rows, 3, "single", 100, "2026-03-30").changes).toEqual([{
      id: "c", index: 3, previousAmount: 94.47, nextAmount: 100,
      previousDueDate: "2026-03-31", nextDueDate: "2026-03-30",
    }]);
  });
  it("rejects paid or partially settled selected installments", () => {
    expect(() => previewCollectiveEdit(rows, 2, "all", 100, "2026-02-28")).toThrow();
    expect(() => previewCollectiveEdit(rows, 4, "future", 100, "2026-04-30")).toThrow();
  });
  it("rejects values with more than two decimals", () => {
    expect(() => previewCollectiveEdit(rows, 1, "all", 10.001, "2026-01-31")).toThrow();
  });
});

describe("prepareCollectiveConfirmation", () => {
  it("requires persisted series identity and includes expected IDs", () => {
    const preview = previewCollectiveEdit(rows, 1, "all", 100, "2026-01-31");
    expect(() => prepareCollectiveConfirmation(null, "a", "all", preview)).toThrow();
    expect(prepareCollectiveConfirmation("series-123", "a", "all", preview)).toMatchObject({
      seriesId: "series-123", selectedPayableId: "a", expectedIds: ["a", "c"],
      count: 2, before: 188.94, after: 200, difference: 11.06,
    });
  });
  it("rejects a selected installment missing from the preview", () => {
    const preview = previewCollectiveEdit(rows, 1, "future", 100, "2026-01-31");
    expect(() => prepareCollectiveConfirmation("series-123", "b", "future", preview)).toThrow();
  });
});

describe("CP-04.1 historical legacy cadence", () => {
  const legacy: PayablePreviewRow[] = [
    {id:"1",index:1,dueDate:"2026-12-13",amount:168.18,status:"pendente",paidAmount:0,recurrence:"nenhuma"},
    {id:"2",index:2,dueDate:"2027-01-03",amount:168.18,status:"pendente",paidAmount:0,recurrence:"nenhuma"},
    {id:"3",index:3,dueDate:"2027-02-03",amount:168.18,status:"pendente",paidAmount:0,recurrence:"nenhuma"},
    {id:"4",index:4,dueDate:"2027-03-03",amount:168.18,status:"pendente",paidAmount:0,recurrence:"nenhuma"},
  ];
  it("preserves irregular historical day offsets instead of inferring monthly cadence", () => {
    const result = previewCollectiveEdit(legacy,1,"all",170.25,"2026-12-20");
    expect(result.changes.map(x=>x.nextDueDate)).toEqual(["2026-12-20","2027-01-10","2027-02-10","2027-03-10"]);
    expect(result.after).toBe(681);
  });
  it("anchors to a middle installment while preserving prior and subsequent dates", () => {
    const result = previewCollectiveEdit(legacy,2,"all",170.25,"2027-01-10");
    expect(result.changes.map(x=>x.nextDueDate)).toEqual(["2026-12-20","2027-01-10","2027-02-10","2027-03-10"]);
  });
  it("rejects mixed recurrence instead of silently coercing", () => {
    const mixed=legacy.map((r,i)=>({...r,recurrence:i===3?"mensal" as const:"nenhuma" as const}));
    expect(()=>previewCollectiveEdit(mixed,1,"all",170.25,"2026-12-20")).toThrow("Recorrência inconsistente");
  });
  it("excludes settled and partially paid rows", () => {
    const restricted=legacy.map((r,i)=>i===1?{...r,status:"pago" as const,paidAmount:168.18}:i===2?{...r,paidAmount:10}:r);
    const result=previewCollectiveEdit(restricted,1,"all",170.25,"2026-12-20");
    expect(result.changes.map(x=>x.id)).toEqual(["1","4"]);
  });
});
