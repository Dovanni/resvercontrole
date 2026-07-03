import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSpreadsheet, CheckCircle2, HelpCircle } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despesas-anuais")({
  head: () => ({ meta: [{ title: "Despesas Anuais — Rosé" }] }),
  component: AnnualExpensesPage,
});

const CATEGORIES = ["todos", "fornecedor", "logistica", "marketing", "aluguel", "impostos", "outros"];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Payable = {
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

type CellAgg = { paid: number; pending: number; items: Payable[] };

function AnnualExpensesPage() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-based
  const [year, setYear] = useState(currentYear);
  const [category, setCategory] = useState("todos");
  const [selectedCell, setSelectedCell] = useState<{ row: string; monthIdx: number; items: Payable[] } | null>(null);

  // Range: Jan/year .. Jan/(year+1)
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-31`;

  const { data } = useQuery({
    queryKey: ["payables-annual", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("id, supplier_id, description, category, amount, due_date, status, paid_amount, paid_at, suppliers(name)")
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as Payable[];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (p: Payable) => {
      const { error } = await supabase.from("payables").update({
        status: "pago", paid_amount: p.amount, paid_at: new Date().toISOString(),
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payables-annual"] });
      qc.invalidateQueries({ queryKey: ["payables"] });
      toast.success("Conta marcada como paga");
      setSelectedCell(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build matrix: rowKey -> 13 cells
  const { rows, matrix, monthTotals, yearTotals } = useMemo(() => {
    const filtered = (data ?? []).filter(p => category === "todos" || p.category === category);
    const rowMap = new Map<string, CellAgg[]>();

    const colIndex = (dateStr: string): number => {
      const d = new Date(dateStr + "T00:00:00");
      const y = d.getFullYear();
      const m = d.getMonth();
      if (y === year) return m;
      if (y === year + 1 && m === 0) return 12;
      return -1;
    };

    for (const p of filtered) {
      const idx = colIndex(p.due_date);
      if (idx < 0) continue;
      const rowKey = p.suppliers?.name || p.description || "Sem descrição";
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, Array.from({ length: 13 }, () => ({ paid: 0, pending: 0, items: [] })));
      }
      const cells = rowMap.get(rowKey)!;
      const cell = cells[idx];
      cell.items.push(p);
      const amt = Number(p.status === "pago" ? (p.paid_amount ?? p.amount) : p.amount);
      if (p.status === "pago") cell.paid += amt;
      else if (p.status !== "cancelado") cell.pending += amt;
    }

    const rows = Array.from(rowMap.keys()).sort((a, b) => a.localeCompare(b));
    const matrix = rows.map(r => rowMap.get(r)!);
    const monthTotals = Array.from({ length: 13 }, (_, i) =>
      matrix.reduce((s, cells) => s + cells[i].paid + cells[i].pending, 0)
    );
    const yearTotals = {
      paid: matrix.reduce((s, cells) => s + cells.reduce((a, c) => a + c.paid, 0), 0),
      pending: matrix.reduce((s, cells) => s + cells.reduce((a, c) => a + c.pending, 0), 0),
    };
    return { rows, matrix, monthTotals, yearTotals };
  }, [data, category, year]);

  const colHeader = (i: number) => i === 12 ? `Jan/${year + 1}` : `${MONTHS[i]}/${String(year).slice(2)}`;
  const isCurrentMonth = (i: number) => year === currentYear && i === currentMonth;

  const rowTotal = (cells: CellAgg[]) => cells.reduce((s, c) => s + c.paid + c.pending, 0);

  const formatCell = (c: CellAgg) => {
    const total = c.paid + c.pending;
    if (total === 0 && c.items.length === 0) return "";
    return brl(total);
  };

  const exportXlsx = () => {
    const header = ["Fornecedor / Categoria", ...Array.from({ length: 13 }, (_, i) => colHeader(i)), "TOTAL ANO"];
    const body = rows.map((r, ri) => {
      const cells = matrix[ri];
      return [r, ...cells.map(c => Number((c.paid + c.pending).toFixed(2))), Number(rowTotal(cells).toFixed(2))];
    });
    const footer = ["DÉBITO TOTAL", ...monthTotals.map(v => Number(v.toFixed(2))), Number((yearTotals.paid + yearTotals.pending).toFixed(2))];
    const ws = XLSX.utils.aoa_to_sheet([header, ...body, footer]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Despesas ${year}`);
    XLSX.writeFile(wb, `despesas_anuais_${year}.xlsx`);
  };

  return (
    <div className="p-6 md:p-8 max-w-[100rem] mx-auto">
      <PageHeader title="Despesas Anuais" subtitle="Visão mês a mês das contas a pagar" />

      <Card className="shadow-soft mb-4">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Ano</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Categoria</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet className="size-4 mr-2" /> Exportar Excel
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-primary/10">
                <th className="sticky left-0 z-10 bg-primary/10 text-left px-3 py-2 font-medium border-b border-r min-w-48">
                  Fornecedor / Categoria
                </th>
                {Array.from({ length: 13 }, (_, i) => (
                  <th
                    key={i}
                    className={[
                      "px-3 py-2 text-right font-medium border-b whitespace-nowrap",
                      isCurrentMonth(i) ? "bg-primary text-primary-foreground" : "",
                    ].join(" ")}
                  >
                    {colHeader(i)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-bold border-b border-l bg-primary/20 whitespace-nowrap">
                  TOTAL ANO
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={15} className="text-center py-10 text-muted-foreground">
                    Nenhuma despesa encontrada para este período.
                  </td>
                </tr>
              )}
              {rows.map((r, ri) => {
                const cells = matrix[ri];
                return (
                  <tr key={r} className={ri % 2 === 0 ? "bg-primary/5" : ""}>
                    <td className="sticky left-0 z-10 px-3 py-2 border-b border-r font-medium truncate max-w-64"
                        style={{ backgroundColor: ri % 2 === 0 ? "hsl(var(--primary) / 0.05)" : "hsl(var(--background))" }}>
                      {r}
                    </td>
                    {cells.map((c, i) => {
                      const total = c.paid + c.pending;
                      const hasItems = c.items.length > 0;
                      const isNeg = total < 0;
                      const onlyPending = c.paid === 0 && c.pending > 0;
                      return (
                        <td
                          key={i}
                          onClick={() => hasItems && setSelectedCell({ row: r, monthIdx: i, items: c.items })}
                          className={[
                            "px-3 py-2 text-right border-b tabular-nums whitespace-nowrap",
                            hasItems ? "cursor-pointer hover:bg-primary/15" : "",
                            isCurrentMonth(i) ? "bg-primary/10" : "",
                            isNeg ? "text-destructive font-medium" : onlyPending ? "text-amber-600" : "",
                          ].join(" ")}
                        >
                          {formatCell(c)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right border-b border-l font-semibold bg-primary/10 tabular-nums whitespace-nowrap">
                      {brl(rowTotal(cells))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-destructive/10 font-bold">
                <td className="sticky left-0 z-10 bg-destructive/10 px-3 py-2 border-t border-r">
                  DÉBITO TOTAL
                </td>
                {monthTotals.map((v, i) => (
                  <td key={i} className={[
                    "px-3 py-2 text-right border-t tabular-nums whitespace-nowrap",
                    isCurrentMonth(i) ? "bg-primary/20" : "",
                  ].join(" ")}>
                    {v > 0 ? brl(v) : ""}
                  </td>
                ))}
                <td className="px-3 py-2 text-right border-t border-l bg-destructive/20 tabular-nums whitespace-nowrap">
                  {brl(yearTotals.paid + yearTotals.pending)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        <Card className="shadow-soft border-green-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total pago no ano</div>
            <div className="text-2xl font-display text-green-600 mt-1">{brl(yearTotals.paid)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-amber-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total pendente no ano</div>
            <div className="text-2xl font-display text-amber-600 mt-1">{brl(yearTotals.pending)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-destructive/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total geral do ano</div>
            <div className="text-2xl font-display text-destructive mt-1">{brl(yearTotals.paid + yearTotals.pending)}</div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedCell} onOpenChange={(o) => !o && setSelectedCell(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCell?.row} — {selectedCell ? colHeader(selectedCell.monthIdx) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {selectedCell?.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.description || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    Venc. {dateBR(it.due_date)} • {it.category} •{" "}
                    <span className={
                      it.status === "pago" ? "text-green-600" :
                      it.status === "atrasado" ? "text-destructive" : "text-amber-600"
                    }>{it.status}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums">
                    {brl(Number(it.status === "pago" ? (it.paid_amount ?? it.amount) : it.amount))}
                  </div>
                  {it.status !== "pago" && it.status !== "cancelado" && (
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => markPaid.mutate(it)} disabled={markPaid.isPending}>
                      <CheckCircle2 className="size-3 mr-1" /> Marcar pago
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCell(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
