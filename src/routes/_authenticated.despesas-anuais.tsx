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
import { TotalizacaoPersonalizadaDespesas } from "@/components/totalizacao-personalizada-despesas";
import {
  getAnnualExpenseMonthIndex,
  getAnnualExpenseValue,
  isAnnualExpenseIncluded,
} from "@/lib/despesas-anuais";

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
  const [showHelp, setShowHelp] = useState(false);

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

    for (const p of filtered) {
      const idx = getAnnualExpenseMonthIndex(p, year);
      if (idx < 0) continue;
      const rowKey = p.suppliers?.name || p.description || "Sem descrição";
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, Array.from({ length: 13 }, () => ({ paid: 0, pending: 0, items: [] })));
      }
      const cells = rowMap.get(rowKey)!;
      const cell = cells[idx];
      cell.items.push(p);
      // Helper compartilhado — cancelado retorna 0 (não impacta paid/pending; ainda listado no drilldown).
      const amt = getAnnualExpenseValue(p);
      if (!isAnnualExpenseIncluded(p)) continue;
      if (p.status === "pago") cell.paid += amt;
      else cell.pending += amt;
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
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)}>
            <HelpCircle className="size-4 mr-1" /> Como funciona esta etapa
          </Button>
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

      <TotalizacaoPersonalizadaDespesas payables={data ?? []} year={year} />



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

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📊 Despesas Anuais — Planejamento e Acompanhamento Financeiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo desta etapa</h3>
              <p className="text-muted-foreground">
                O módulo Despesas Anuais permite visualizar, acompanhar e analisar todas as despesas previstas e realizadas ao longo do ano, organizadas por fornecedor, categoria e período.
              </p>
              <p className="text-muted-foreground mt-2">
                Oferece uma visão consolidada dos compromissos financeiros da empresa, auxiliando no planejamento financeiro, no controle do fluxo de caixa e na tomada de decisões estratégicas.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">📌 O que pode ser feito</h3>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Visualizar todas as despesas do ano</li>
                <li>Consultar despesas por fornecedor</li>
                <li>Consultar despesas por categoria</li>
                <li>Comparar despesas entre os meses</li>
                <li>Identificar despesas recorrentes</li>
                <li>Analisar a evolução anual dos gastos</li>
                <li>Filtrar informações por ano e categoria</li>
                <li>Exportar os dados para Excel</li>
                <li>Apoiar auditorias financeiras</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">🔄 Fluxo recomendado</h3>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li><b>Selecionar o ano</b> — escolha o exercício financeiro que deseja analisar.</li>
                <li><b>Filtrar por categoria</b> (opcional) — Administrativas, Impostos, Serviços, Cartões, Fretes, Tecnologia, Telefonia, Internet, Outros.</li>
                <li><b>Consultar a matriz anual</b> — fornecedor, categoria, despesas por mês, evolução mensal e total acumulado anual.</li>
                <li><b>Identificar oportunidades</b> — aumento de custos, despesas recorrentes, gastos extraordinários, concentração de despesas, economia possível.</li>
                <li><b>Exportar informações</b> — use "Exportar Excel" para relatórios externos, apresentações ou análises complementares.</li>
              </ol>
            </section>

            <section>
              <h3 className="font-semibold mb-1">📊 Como ler a tabela</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><b>Linhas</b> = fornecedores ou categorias de despesa</li>
                <li><b>Colunas</b> = meses do ano (Jan a Dez) + Jan do ano seguinte</li>
                <li><b>Células com valor</b>: há despesa lançada no mês — clique para ver detalhes</li>
                <li><b>Células vazias</b>: sem lançamento no mês</li>
                <li><b>Coluna TOTAL ANO</b>: soma de todos os meses da linha</li>
                <li><b>Linha DÉBITO TOTAL</b>: soma das despesas de cada mês</li>
                <li><span className="text-amber-600 font-medium">Âmbar</span>: valor pendente · Sem cor: já pago · <span className="text-primary font-medium">Azul</span>: mês atual</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">⚙️ De onde vêm os dados</h3>
              <p className="text-muted-foreground">
                Todos os valores são puxados automaticamente da tela <b>Contas a Pagar</b>. Esta tela é apenas uma visualização consolidada — não é necessário lançar nada aqui.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo do resultado</h3>
              <p className="text-muted-foreground mb-1">Visão completa das despesas anuais permitindo acompanhar a evolução dos gastos, controlar despesas recorrentes, apoiar o planejamento financeiro, prever necessidades de caixa, identificar oportunidades de redução de custos e subsidiar decisões estratégicas. Alimenta:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Financeiro</li>
                <li>Fluxo de Caixa</li>
                <li>Business Intelligence (BI)</li>
                <li>Relatórios Gerenciais</li>
                <li>Indicadores Financeiros</li>
                <li>Planejamento Orçamentário</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Registrar corretamente todas as despesas</li>
                <li>Classificar despesas na categoria adequada</li>
                <li>Conferir valores antes da confirmação</li>
                <li>Atualizar despesas recorrentes quando houver alteração</li>
                <li>Revisar periodicamente os gastos por fornecedor</li>
                <li>Utilizar os filtros para análises específicas</li>
                <li>Exportar relatórios sempre que necessário para auditorias e planejamento</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">⚠️ Importante</h3>
              <p className="text-muted-foreground">
                As informações refletem diretamente a saúde financeira da empresa. A correta classificação e atualização das despesas garante maior precisão nos indicadores, fluxo de caixa, relatórios gerenciais e BI do Rosé.
              </p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
