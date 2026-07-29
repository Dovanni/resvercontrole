import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSpreadsheet, FileText, ShoppingBag, Calculator, Package, Landmark, HelpCircle } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { buildBankReport, fromCents, type BankMovementLike } from "@/lib/bank/balances";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Vejamais" }] }),
  component: ReportsPage,
});

function monthLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function ReportsPage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayStr);
  const [showHelp, setShowHelp] = useState(false);

  const { data: sales } = useQuery({
    queryKey: ["rep-sales", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, discount, payment_method, channel, sold_at, customer_name, status, customers(name)")
        .gte("sold_at", new Date(from).toISOString())
        .lte("sold_at", new Date(to + "T23:59:59").toISOString())
        .order("sold_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: finance } = useQuery({
    queryKey: ["rep-finance", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("type, category, amount, entry_date")
        .gte("entry_date", new Date(from).toISOString())
        .lte("entry_date", new Date(to + "T23:59:59").toISOString());
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["rep-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("name, sku, stock, min_stock, cost_price, sale_price, wholesale_price, status")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        cost: Number(p.cost_price ?? 0),
        price: Number(p.sale_price ?? 0),
      })) as any[];
    },
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["rep-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id,name,bank,color,initial_balance,status")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string; initial_balance: number; status: string }[];
    },
  });

  // Precisa de TODOS os movimentos até a data "Até" para apurar o saldo de
  // abertura do período (não apenas os movimentos do período).
  const { data: bankMovements } = useQuery({
    queryKey: ["rep-bank-movements", to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements" as any)
        .select("account_id,destination_account_id,type,category,description,amount,movement_date")
        .lte("movement_date", to)
        .order("movement_date");
      if (error) throw error;
      return (data ?? []) as unknown as BankMovementLike[];
    },
  });

  const includeInactive = false;
  const bankReport = useMemo(
    () =>
      buildBankReport(
        (bankAccounts ?? []).filter((a) => includeInactive || a.status === "ativa"),
        bankMovements ?? [],
        from,
        to,
      ),
    [bankAccounts, bankMovements, from, to]
  );

  const isToday = to === todayStr;
  const closingLabel = isToday ? "Saldo atual" : `Saldo final em ${dateBR(to)}`;
  const totalBankBalance = fromCents(bankReport.totals.closingCents);

  const drillMovements = useMemo(() => {
    if (!drillAccountId) return [];
    return (bankMovements ?? []).filter(
      (m) =>
        m.movement_date >= from &&
        m.movement_date <= to &&
        (m.account_id === drillAccountId || m.destination_account_id === drillAccountId)
    );
  }, [bankMovements, drillAccountId, from, to]);

  const drillAccount = bankReport.accounts.find((a) => a.id === drillAccountId);

  const bankRows = () =>
    bankReport.accounts.map((a) => ({
      Conta: a.name,
      Banco: a.bank,
      Status: a.status,
      "Saldo inicial do período": fromCents(a.openingCents),
      Entradas: fromCents(a.inflowCents),
      Saídas: fromCents(a.outflowCents),
      "Movimentação líquida": fromCents(a.netCents),
      [closingLabel]: fromCents(a.closingCents),
    }));

  const exportBankXlsx = () => {
    const wb = XLSX.utils.book_new();
    // Sheet 1: posição das contas
    const positions: any[] = bankRows();
    positions.push({
      Conta: "TOTAL CONSOLIDADO",
      Banco: "",
      Status: "",
      "Saldo inicial do período": fromCents(bankReport.totals.openingCents),
      Entradas: fromCents(bankReport.totals.inflowCents),
      Saídas: fromCents(bankReport.totals.outflowCents),
      "Movimentação líquida": fromCents(bankReport.totals.netCents),
      [closingLabel]: totalBankBalance,
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(positions), "Posição");

    // Sheet 2: movimentações por categoria (apenas o período)
    const periodMovements = (bankMovements ?? []).filter((m) => m.movement_date >= from && m.movement_date <= to);
    const byCategory: Record<string, { entrada: number; saida: number }> = {};
    for (const m of periodMovements) {
      byCategory[m.category] ??= { entrada: 0, saida: 0 };
      if (m.type === "entrada") byCategory[m.category].entrada += Number(m.amount);
      else if (m.type === "saida") byCategory[m.category].saida += Number(m.amount);
    }
    const catRows = Object.entries(byCategory).map(([cat, v]) => ({
      Categoria: cat, Entradas: v.entrada, Saídas: v.saida, Líquido: v.entrada - v.saida,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), "Por categoria");

    // Sheet 3: movimentações detalhadas
    const accNames = Object.fromEntries((bankAccounts ?? []).map((a) => [a.id, a.name]));
    const detail = periodMovements.map((m) => ({
      Data: dateBR(m.movement_date),
      Conta: accNames[m.account_id] ?? "",
      Tipo: m.type,
      Categoria: m.category,
      Descrição: m.description,
      Valor: Number(m.amount),
      "Conta destino": m.destination_account_id ? (accNames[m.destination_account_id] ?? "") : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Movimentações");

    XLSX.writeFile(wb, `bancario_${from}_${to}.xlsx`);
  };

  const exportBankPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Relatório bancário", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${dateBR(from)} a ${dateBR(to)}  •  ${closingLabel} consolidado: ${brl(totalBankBalance)}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Conta", "Banco", "Status", "Saldo inicial", "Entradas", "Saídas", "Líquido", closingLabel]],
      body: bankReport.accounts.map((a) => [
        a.name,
        a.bank,
        a.status,
        brl(fromCents(a.openingCents)),
        brl(fromCents(a.inflowCents)),
        brl(fromCents(a.outflowCents)),
        brl(fromCents(a.netCents)),
        brl(fromCents(a.closingCents)),
      ]),
      foot: [[
        "TOTAL", "", "",
        brl(fromCents(bankReport.totals.openingCents)),
        brl(fromCents(bankReport.totals.inflowCents)),
        brl(fromCents(bankReport.totals.outflowCents)),
        brl(fromCents(bankReport.totals.netCents)),
        brl(totalBankBalance),
      ]],
      headStyles: { fillColor: [219, 39, 119] },
      footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    });
    doc.save(`bancario_${from}_${to}.pdf`);
  };


  const dre = useMemo(() => {
    const byMonth: Record<string, { income: Record<string, number>; expense: Record<string, number> }> = {};
    for (const e of finance ?? []) {
      const d = new Date(e.entry_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[k] ??= { income: {}, expense: {} };
      const bucket = e.type === "income" ? byMonth[k].income : byMonth[k].expense;
      bucket[e.category] = (bucket[e.category] ?? 0) + Number(e.amount);
    }
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      const totIn = Object.values(v.income).reduce((s, n) => s + n, 0);
      const totEx = Object.values(v.expense).reduce((s, n) => s + n, 0);
      const [y, m] = k.split("-");
      return {
        key: k,
        label: monthLabel(new Date(Number(y), Number(m) - 1, 1)),
        income: v.income,
        expense: v.expense,
        totIncome: totIn,
        totExpense: totEx,
        result: totIn - totEx,
      };
    });
  }, [finance]);

  /* ============ Vendas por período ============ */
  const exportSalesXlsx = () => {
    const rows = (sales ?? []).map((s) => ({
      Data: dateBR(s.sold_at),
      Cliente: s.customers?.name ?? s.customer_name ?? "Balcão",
      Canal: s.channel,
      Pagamento: s.payment_method,
      Status: s.status,
      Desconto: Number(s.discount),
      Total: Number(s.total),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    XLSX.writeFile(wb, `vendas_${from}_${to}.xlsx`);
  };

  const exportSalesPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de vendas", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${dateBR(from)} a ${dateBR(to)}`, 14, 26);
    const total = (sales ?? []).reduce((s, x) => s + Number(x.total), 0);
    autoTable(doc, {
      startY: 32,
      head: [["Data", "Cliente", "Canal", "Pag.", "Status", "Total"]],
      body: (sales ?? []).map((s) => [
        dateBR(s.sold_at),
        s.customers?.name ?? s.customer_name ?? "Balcão",
        s.channel,
        s.payment_method,
        s.status,
        brl(Number(s.total)),
      ]),
      foot: [["", "", "", "", "Total", brl(total)]],
      headStyles: { fillColor: [219, 39, 119] },
      footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9 },
    });
    doc.save(`vendas_${from}_${to}.pdf`);
  };

  /* ============ DRE ============ */
  const exportDreXlsx = () => {
    const wb = XLSX.utils.book_new();
    const rows: any[] = [];
    for (const m of dre) {
      rows.push({ Mês: m.label, Tipo: "RECEITAS", Categoria: "", Valor: "" });
      for (const [c, v] of Object.entries(m.income)) rows.push({ Mês: "", Tipo: "Receita", Categoria: c, Valor: v });
      rows.push({ Mês: "", Tipo: "Total Receitas", Categoria: "", Valor: m.totIncome });
      rows.push({ Mês: "", Tipo: "DESPESAS", Categoria: "", Valor: "" });
      for (const [c, v] of Object.entries(m.expense)) rows.push({ Mês: "", Tipo: "Despesa", Categoria: c, Valor: v });
      rows.push({ Mês: "", Tipo: "Total Despesas", Categoria: "", Valor: m.totExpense });
      rows.push({ Mês: "", Tipo: "RESULTADO", Categoria: "", Valor: m.result });
      rows.push({});
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "DRE");
    XLSX.writeFile(wb, `dre_${from}_${to}.xlsx`);
  };

  const exportDrePdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("DRE Simplificado", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${dateBR(from)} a ${dateBR(to)}`, 14, 26);
    let y = 34;
    for (const m of dre) {
      const body: any[] = [];
      body.push([{ content: "RECEITAS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } }]);
      for (const [c, v] of Object.entries(m.income)) body.push([c, brl(v)]);
      body.push([{ content: "Total Receitas", styles: { fontStyle: "bold" } }, { content: brl(m.totIncome), styles: { fontStyle: "bold" } }]);
      body.push([{ content: "DESPESAS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } }]);
      for (const [c, v] of Object.entries(m.expense)) body.push([c, brl(v)]);
      body.push([{ content: "Total Despesas", styles: { fontStyle: "bold" } }, { content: brl(m.totExpense), styles: { fontStyle: "bold" } }]);
      body.push([
        { content: "RESULTADO", styles: { fontStyle: "bold", fillColor: m.result >= 0 ? [220, 252, 231] : [254, 226, 226] } },
        { content: brl(m.result), styles: { fontStyle: "bold", fillColor: m.result >= 0 ? [220, 252, 231] : [254, 226, 226] } },
      ]);
      autoTable(doc, {
        startY: y,
        head: [[m.label.toUpperCase(), ""]],
        body,
        headStyles: { fillColor: [219, 39, 119] },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: "right" } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > 250 && m !== dre[dre.length - 1]) { doc.addPage(); y = 18; }
    }
    doc.save(`dre_${from}_${to}.pdf`);
  };

  /* ============ Estoque ============ */
  const stockValue = useMemo(
    () => (products ?? []).reduce((s, p) => s + Number(p.cost ?? 0) * Number(p.stock ?? 0), 0),
    [products]
  );

  const exportStockXlsx = () => {
    const rows = (products ?? []).map((p) => ({
      SKU: p.sku ?? "",
      Produto: p.name,
      Estoque: Number(p.stock),
      "Mín.": Number(p.min_stock),
      Custo: Number(p.cost ?? 0),
      Preço: Number(p.price),
      "Preço atacado": Number(p.wholesale_price ?? 0),
      "Valor estoque": Number(p.cost ?? 0) * Number(p.stock ?? 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, `estoque_${todayStr}.xlsx`);
  };

  const exportStockPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Posição de estoque", 14, 18);
    doc.setFontSize(10);
    doc.text(`Posição em: ${dateBR(todayStr)}  •  Valor total: ${brl(stockValue)}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["SKU", "Produto", "Estoque", "Mín", "Custo", "Preço", "Valor"]],
      body: (products ?? []).map((p) => [
        p.sku ?? "—",
        p.name,
        Number(p.stock),
        Number(p.min_stock),
        brl(Number(p.cost ?? 0)),
        brl(Number(p.price)),
        brl(Number(p.cost ?? 0) * Number(p.stock ?? 0)),
      ]),
      headStyles: { fillColor: [219, 39, 119] },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    });
    doc.save(`estoque_${todayStr}.pdf`);
  };

  const salesTotal = (sales ?? []).reduce((s, x) => s + Number(x.total), 0);
  const monthlyResult = dre.reduce((s, m) => s + m.result, 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Relatórios"
        subtitle="Exporte relatórios em PDF ou Excel"
        action={
          <Button variant="ghost" onClick={() => setShowHelp(true)}>
            <HelpCircle className="size-4 mr-1" /> Como funciona esta etapa
          </Button>
        }
      />

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">📑 Relatórios — Exportação e Análise Gerencial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo desta etapa</h3>
              <p>O módulo Relatórios reúne e organiza as principais informações geradas pelo Vejamais, permitindo exportar documentos gerenciais em PDF ou Excel para análise, auditoria, controle financeiro e apoio à tomada de decisões. Consolida dados de Vendas, Compras, Estoque, Financeiro e Contas Bancárias.</p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">📌 O que pode ser feito</h3>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Selecionar período desejado</li>
                <li>Gerar relatórios em PDF ou Excel</li>
                <li>Consultar indicadores financeiros, vendas e estoque</li>
                <li>Compartilhar com contabilidade, administração ou gestão</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">🔄 Fluxo recomendado</h3>
              <ol className="list-decimal pl-5 space-y-0.5">
                <li>Definir período (data inicial e final)</li>
                <li>Escolher o relatório (Vendas, DRE, Estoque, Bancário)</li>
                <li>Selecionar formato — 📄 PDF (impressão/auditoria) ou 📊 Excel (análises/filtros)</li>
                <li>Gerar o relatório</li>
                <li>Utilizar para gestão, reuniões, planejamento, auditorias, apoio ao contador</li>
              </ol>
            </section>
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo do resultado</h3>
              <p>Documentos gerenciais confiáveis, organizados e prontos para consulta ou compartilhamento, permitindo acompanhar o desempenho da empresa e apoiar decisões estratégicas.</p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">📈 Como interpretar os relatórios</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Vendas por período:</strong> quantidade, faturamento, desempenho e evolução comercial</li>
                <li><strong>DRE Simplificado:</strong> receitas, despesas e resultado (lucro/prejuízo) — indicador central da saúde financeira</li>
                <li><strong>Posição de Estoque:</strong> quantidade, valor e posição dos itens — auxilia planejamento de compras</li>
                <li><strong>Bancário:</strong> contas, saldos e movimentações — acompanha disponibilidade financeira</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Selecionar corretamente o período</li>
                <li>Conferir se os lançamentos estão atualizados antes da emissão</li>
                <li>PDF para documentação oficial; Excel para análises detalhadas</li>
                <li>Arquivar relatórios periodicamente</li>
                <li>Compartilhar apenas com pessoas autorizadas</li>
                <li>Revisar indicadores antes de decisões estratégicas</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">⚠️ Importante</h3>
              <p>Os relatórios dependem da qualidade das informações registradas nos demais módulos. Quanto mais completos e atualizados, mais precisos os documentos gerados.</p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">🔗 Integração</h3>
              <p>Consolida automaticamente informações de: Dashboard, BI, Curva ABC, Clientes, Fornecedores, Produtos, Vendas, Compras, Contas a Pagar, Contas a Receber, Fluxo de Caixa, Balancete, Contas Bancárias e Cartões de Crédito.</p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-soft mb-6">
        <CardContent className="p-4 grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <ReportCard
          icon={<ShoppingBag className="size-5" />}
          title="Vendas por período"
          desc={`${(sales ?? []).length} vendas • ${brl(salesTotal)}`}
          onPdf={exportSalesPdf}
          onXlsx={exportSalesXlsx}
        />
        {/*
          O DRE deixou de ser calculado aqui. A demonstração oficial passou a ser
          o DRE Tradicional por competência, com fonte única de cálculo em
          `src/lib/dre/engine.ts`. Manter um segundo cálculo nesta tela geraria
          divergência de resultado entre relatórios.
        */}
        <Link to="/dre" className="block">
          <div className="h-full rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-2 text-primary">
              <Calculator className="size-5" />
              <span className="font-semibold text-foreground">DRE Tradicional</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Demonstração do Resultado por regime de competência, com comparativos, margens e
              exportação em PDF e Excel.
            </p>
            <span className="mt-3 inline-block text-sm font-medium text-primary">
              Abrir DRE →
            </span>
          </div>
        </Link>
        <ReportCard
          icon={<Package className="size-5" />}
          title="Posição de estoque"
          desc={`${(products ?? []).length} produtos • ${brl(stockValue)}`}
          onPdf={exportStockPdf}
          onXlsx={exportStockXlsx}
        />
        <ReportCard
          icon={<Landmark className="size-5" />}
          title="Bancário"
          desc={`${(bankAccounts ?? []).filter(a => a.status === "ativa").length} contas • ${brl(totalBankBalance)}`}
          onPdf={exportBankPdf}
          onXlsx={exportBankXlsx}
        />
      </div>
    </div>
  );
}

function ReportCard({ icon, title, desc, onPdf, onXlsx }: { icon: React.ReactNode; title: string; desc: string; onPdf: () => void; onXlsx: () => void }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="inline-flex size-10 rounded-xl bg-primary/10 text-primary items-center justify-center mb-3">{icon}</div>
        <div className="font-display text-lg">{title}</div>
        <div className="text-xs text-muted-foreground mt-1 mb-4">{desc}</div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onPdf}><FileText className="size-4 mr-1" /> PDF</Button>
          <Button variant="outline" className="flex-1" onClick={onXlsx}><FileSpreadsheet className="size-4 mr-1" /> Excel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
