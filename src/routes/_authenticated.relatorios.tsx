import { createFileRoute } from "@tanstack/react-router";
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
import { FileSpreadsheet, FileText, ShoppingBag, Calculator, Package } from "lucide-react";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Rosé" }] }),
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
        .select("name, sku, stock, min_stock, cost, price, wholesale_price")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

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
      <PageHeader title="Relatórios" subtitle="Exporte relatórios em PDF ou Excel" />

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
        <ReportCard
          icon={<Calculator className="size-5" />}
          title="DRE simplificado"
          desc={`Resultado: ${brl(monthlyResult)}`}
          onPdf={exportDrePdf}
          onXlsx={exportDreXlsx}
        />
        <ReportCard
          icon={<Package className="size-5" />}
          title="Posição de estoque"
          desc={`${(products ?? []).length} produtos • ${brl(stockValue)}`}
          onPdf={exportStockPdf}
          onXlsx={exportStockXlsx}
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
