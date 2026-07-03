import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown, Scale, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { brl, dateBR } from "@/lib/format";
import { CashProjection } from "@/components/cash-projection";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Line, ComposedChart, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/balancete")({
  head: () => ({ meta: [{ title: "Balancete — Rosé" }] }),
  component: BalancetePage,
});

const COLORS = ["#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"];

type Period = "este_mes" | "mes_anterior" | "3m" | "6m" | "ano" | "custom";

function rangeFor(p: Period): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const y = today.getFullYear(), m = today.getMonth();
  switch (p) {
    case "este_mes": return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "mes_anterior": return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case "3m": return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "6m": return { from: fmt(new Date(y, m - 5, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "ano": return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) };
    default: return { from: fmt(new Date(y, m, 1)), to: fmt(today) };
  }
}

function BalancetePage() {
  const [period, setPeriod] = useState<Period>("este_mes");
  const [showHelp, setShowHelp] = useState(false);
  const init = rangeFor("este_mes");
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);

  const setQuick = (p: Period) => {
    setPeriod(p);
    if (p !== "custom") { const r = rangeFor(p); setFrom(r.from); setTo(r.to); }
  };

  const { data: bankAccounts } = useQuery({
    queryKey: ["balancete-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id, name, bank, color, status")
        .eq("status", "ativa")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string; status: string }[];
    },
  });

  const { data: bankMovs } = useQuery({
    queryKey: ["balancete-bankmovs", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements" as any)
        .select("account_id, movement_date, type, category, amount, origin")
        .gte("movement_date", from).lte("movement_date", to)
        .neq("origin", "saldo_inicial");
      if (error) { console.error("[balancete] bank_movements error", error); throw error; }
      console.log("[balancete] bank_movements:", data?.length, "período:", from, "→", to);
      return (data ?? []) as unknown as { account_id: string; movement_date: string; type: string; category: string | null; amount: number }[];
    },
  });

  // Todas as movimentações (com data) para calcular saldo até uma data de corte
  const { data: allMovs } = useQuery({
    queryKey: ["balancete-allmovs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements" as any)
        .select("account_id, movement_date, type, amount");
      if (error) throw error;
      return (data ?? []) as unknown as { account_id: string; movement_date: string; type: string; amount: number }[];
    },
  });

  // Data de corte: última data com movimento dentro do período;
  // se não houver movimento no período, usa a última data com movimento ANTES do período.
  const { cutoffDate, periodoSemMovimento } = useMemo(() => {
    const movs = allMovs ?? [];
    let maxIn = "";
    let maxBefore = "";
    for (const m of movs) {
      const d = m.movement_date;
      if (d >= from && d <= to) { if (d > maxIn) maxIn = d; }
      else if (d < from) { if (d > maxBefore) maxBefore = d; }
    }
    if (maxIn) return { cutoffDate: maxIn, periodoSemMovimento: false };
    if (maxBefore) return { cutoffDate: maxBefore, periodoSemMovimento: true };
    return { cutoffDate: to, periodoSemMovimento: true };
  }, [allMovs, from, to]);

  const saldoPorConta = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of allMovs ?? []) {
      if (m.movement_date > cutoffDate) continue;
      const v = Number(m.amount || 0);
      map[m.account_id] = (map[m.account_id] ?? 0) + (m.type === "entrada" ? v : -v);
    }
    return map;
  }, [allMovs, cutoffDate]);

  // Receitas agrupadas por conta bancária → categoria (todas as contas ativas, mesmo sem movimentação)
  const receitasPorConta = useMemo(() => {
    const accounts = bankAccounts ?? [];
    const grouped: Record<string, { account: { id: string; name: string; bank: string; color: string }; cats: Record<string, number>; subtotal: number }> = {};
    for (const a of accounts) grouped[a.id] = { account: a, cats: {}, subtotal: 0 };
    for (const m of bankMovs ?? []) {
      if (m.type !== "entrada") continue;
      const g = grouped[m.account_id];
      if (!g) continue;
      const cat = m.category || "Outros";
      const v = Number(m.amount || 0);
      g.cats[cat] = (g.cats[cat] ?? 0) + v;
      g.subtotal += v;
    }
    return Object.values(grouped).sort((a, b) => a.account.name.localeCompare(b.account.name));
  }, [bankAccounts, bankMovs]);

  const { data: payables } = useQuery({
    queryKey: ["balancete-pay", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("id, amount, paid_amount, status, category, due_date, paid_at")
        .gte("due_date", from).lte("due_date", to);
      if (error) throw error;
      return data ?? [];
    },
  });


  const totalEntradas = useMemo(
    () => (bankMovs ?? []).filter((m) => m.type === "entrada").reduce((s, m) => s + Number(m.amount || 0), 0),
    [bankMovs]
  );
  const totalSaidasBank = useMemo(
    () => (bankMovs ?? []).filter((m) => m.type === "saida").reduce((s, m) => s + Number(m.amount || 0), 0),
    [bankMovs]
  );

  const despesas = useMemo(() => {
    const map: Record<string, { previsto: number; realizado: number }> = {};
    for (const p of (payables ?? []) as any[]) {
      const cat = p.category || "Outros";
      map[cat] = map[cat] ?? { previsto: 0, realizado: 0 };
      map[cat].previsto += Number(p.amount || 0);
      if (p.status === "pago") map[cat].realizado += Number(p.paid_amount || p.amount || 0);
    }
    return map;
  }, [payables]);

  // Para compatibilidade com PDF/Excel e tabela Resultado, mantemos receitas como mapa categoria→valor
  const receitas = useMemo(() => {
    const map: Record<string, { previsto: number; realizado: number }> = {};
    for (const g of receitasPorConta) {
      for (const [cat, v] of Object.entries(g.cats)) {
        const key = `${g.account.name} — ${cat}`;
        map[key] = { previsto: v, realizado: v };
      }
    }
    return map;
  }, [receitasPorConta]);

  const totalSaldoAtual = useMemo(
    () => Object.values(saldoPorConta).reduce((s, v) => s + v, 0),
    [saldoPorConta]
  );
  const receitasRealizadas = totalSaldoAtual;

  const totRec = useMemo(() => ({ previsto: totalEntradas, realizado: receitasRealizadas }), [totalEntradas, receitasRealizadas]);
  const totDesp = useMemo(() => Object.values(despesas).reduce((a, v) => ({ previsto: a.previsto + v.previsto, realizado: a.realizado + v.realizado }), { previsto: 0, realizado: 0 }), [despesas]);

  const resPrevisto = totalEntradas - totDesp.previsto;
  const resRealizado = receitasRealizadas - totDesp.realizado;
  const margemPrev = totalEntradas ? (resPrevisto / totalEntradas) * 100 : 0;
  const margemReal = receitasRealizadas ? (resRealizado / receitasRealizadas) * 100 : 0;

  const monthly = useMemo(() => {
    const f = new Date(from), t = new Date(to);
    const months: { key: string; label: string; receitas: number; despesas: number; resultado: number }[] = [];
    const cur = new Date(f.getFullYear(), f.getMonth(), 1);
    while (cur <= t) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: cur.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), receitas: 0, despesas: 0, resultado: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
    const idx: Record<string, number> = {};
    months.forEach((m, i) => (idx[m.key] = i));
    for (const m of bankMovs ?? []) {
      const d = new Date(m.movement_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (idx[k] == null) continue;
      const v = Number(m.amount || 0);
      if (m.type === "entrada") months[idx[k]].receitas += v;
      else if (m.type === "saida") months[idx[k]].despesas += v;
    }
    months.forEach((m) => (m.resultado = m.receitas - m.despesas));
    return months;
  }, [from, to, bankMovs]);

  const pieData = useMemo(() =>
    Object.entries(despesas).map(([name, v]) => ({ name, value: v.realizado })).filter(x => x.value > 0)
  , [despesas]);


  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("ANGELA MARIA MOMO RODRIGUES MEI", 14, 16);
    doc.setFontSize(10);
    doc.text("CNPJ: 33.613.716/0001-13", 14, 22);
    doc.setFontSize(16);
    doc.text("Balancete Financeiro", 14, 32);
    doc.setFontSize(10);
    doc.text(`Período: ${dateBR(from)} a ${dateBR(to)}`, 14, 38);

    autoTable(doc, {
      startY: 44,
      head: [["RECEITAS", "Previsto", "Realizado", "Diferença"]],
      body: Object.entries(receitas).map(([c, v]) => [c, brl(v.previsto), brl(v.realizado), brl(v.realizado - v.previsto)]),
      foot: [["TOTAL RECEITAS", brl(totRec.previsto), brl(totRec.realizado), brl(totRec.realizado - totRec.previsto)]],
      headStyles: { fillColor: [16, 185, 129] }, footStyles: { fillColor: [220, 252, 231], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9 }, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [["DESPESAS", "Previsto", "Realizado", "Diferença"]],
      body: Object.entries(despesas).map(([c, v]) => [c, brl(v.previsto), brl(v.realizado), brl(v.previsto - v.realizado)]),
      foot: [["TOTAL DESPESAS", brl(totDesp.previsto), brl(totDesp.realizado), brl(totDesp.previsto - totDesp.realizado)]],
      headStyles: { fillColor: [239, 68, 68] }, footStyles: { fillColor: [254, 226, 226], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9 }, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [["RESULTADO", "Previsto", "Realizado"]],
      body: [
        ["(+) Receitas", brl(totRec.previsto), brl(totRec.realizado)],
        ["(-) Despesas", brl(totDesp.previsto), brl(totDesp.realizado)],
        ["(=) RESULTADO", brl(resPrevisto), brl(resRealizado)],
        ["Margem %", `${margemPrev.toFixed(2)}%`, `${margemReal.toFixed(2)}%`],
      ],
      headStyles: { fillColor: [219, 39, 119] }, styles: { fontSize: 9 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });

    if (monthly.length > 1) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Mês", "Receitas", "Despesas", "Resultado", "Margem"]],
        body: monthly.map((m) => [m.label, brl(m.receitas), brl(m.despesas), brl(m.resultado), m.receitas ? `${((m.resultado / m.receitas) * 100).toFixed(2)}%` : "-"]),
        headStyles: { fillColor: [100, 116, 139] }, styles: { fontSize: 9 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      });
    }

    doc.setFontSize(8);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} pelo Rosé Sistema`, 14, 285);
    doc.save(`balancete_${from}_${to}.pdf`);
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(Object.entries(receitas).map(([c, v]) => ({ Categoria: c, Previsto: v.previsto, Realizado: v.realizado, Diferença: v.realizado - v.previsto })));
    XLSX.utils.book_append_sheet(wb, ws1, "Receitas");
    const ws2 = XLSX.utils.json_to_sheet(Object.entries(despesas).map(([c, v]) => ({ Categoria: c, Previsto: v.previsto, Realizado: v.realizado, Diferença: v.previsto - v.realizado })));
    XLSX.utils.book_append_sheet(wb, ws2, "Despesas");
    const ws3 = XLSX.utils.json_to_sheet([
      { Item: "Total Receitas", Previsto: totRec.previsto, Realizado: totRec.realizado },
      { Item: "Total Despesas", Previsto: totDesp.previsto, Realizado: totDesp.realizado },
      { Item: "RESULTADO", Previsto: resPrevisto, Realizado: resRealizado },
      { Item: "Margem %", Previsto: margemPrev, Realizado: margemReal },
    ]);
    XLSX.utils.book_append_sheet(wb, ws3, "Resultado");
    const ws4 = XLSX.utils.json_to_sheet(monthly.map((m) => ({ Mês: m.label, Receitas: m.receitas, Despesas: m.despesas, Resultado: m.resultado, "Margem %": m.receitas ? (m.resultado / m.receitas) * 100 : 0 })));
    XLSX.utils.book_append_sheet(wb, ws4, "Mensal");
    XLSX.writeFile(wb, `balancete_${from}_${to}.xlsx`);
  };

  const QuickBtn = ({ p, children }: { p: Period; children: React.ReactNode }) => (
    <Button variant={period === p ? "default" : "outline"} size="sm" onClick={() => setQuick(p)} className={period === p ? "bg-gradient-primary text-primary-foreground" : ""}>
      {children}
    </Button>
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Balancete" subtitle="Resultado financeiro consolidado" />

      <Card className="shadow-soft mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <QuickBtn p="este_mes">Este mês</QuickBtn>
            <QuickBtn p="mes_anterior">Mês anterior</QuickBtn>
            <QuickBtn p="3m">Últimos 3 meses</QuickBtn>
            <QuickBtn p="6m">Últimos 6 meses</QuickBtn>
            <QuickBtn p="ano">Ano atual</QuickBtn>
            <QuickBtn p="custom">Personalizado</QuickBtn>
          </div>
          {period === "custom" && (
            <div className="flex flex-wrap gap-3 items-end">
              <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={exportPdf} variant="outline"><FileText className="size-4 mr-1" /> Exportar PDF</Button>
            <Button onClick={exportXlsx} variant="outline"><FileSpreadsheet className="size-4 mr-1" /> Exportar Excel</Button>
            <Button onClick={() => setShowHelp(true)} variant="ghost" size="sm"><HelpCircle className="size-4 mr-1" /> Como funciona esta etapa</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📊 BALANCETE — RESULTADO FINANCEIRO CONSOLIDADO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo desta etapa</h3>
              <p className="text-muted-foreground">O módulo Balancete apresenta uma visão consolidada da situação financeira da empresa em um determinado período, permitindo acompanhar receitas, despesas, saldo bancário e o resultado financeiro (superávit ou déficit). Seu principal objetivo é fornecer uma análise financeira resumida e confiável para apoiar decisões gerenciais, planejamento financeiro e acompanhamento da saúde econômica da empresa.</p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">📌 O que pode ser feito</h3>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li>Visualizar o resultado financeiro consolidado;</li>
                <li>Consultar receitas por conta bancária;</li>
                <li>Consultar despesas consolidadas;</li>
                <li>Comparar entradas e saídas;</li>
                <li>Verificar o saldo atualizado das contas bancárias;</li>
                <li>Identificar superávit ou déficit;</li>
                <li>Filtrar informações por período;</li>
                <li>Exportar em PDF ou Excel;</li>
                <li>Utilizar os dados para análises gerenciais e auditorias.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">🔄 Fluxo recomendado</h3>
              <ol className="list-decimal pl-5 text-muted-foreground space-y-0.5">
                <li>Selecionar o período (Este mês, Mês anterior, 3m, 6m, Ano, Personalizado);</li>
                <li>Analisar os indicadores superiores (entradas, saídas, resultado, superávit/déficit);</li>
                <li>Consultar Receitas — Contas Bancárias (contas, entradas, saldo atualizado, total);</li>
                <li>Consultar Despesas — Contas a Pagar (despesas, pagamentos, compromissos, total);</li>
                <li>Interpretar o Resultado (Superávit ou Déficit);</li>
                <li>Exportar o Balancete em PDF ou Excel quando necessário.</li>
              </ol>
            </section>
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo do resultado</h3>
              <p className="text-muted-foreground">Ao final, o gestor terá uma visão consolidada do desempenho financeiro, permitindo acompanhar receitas e despesas, verificar saldo disponível, identificar superávit ou déficit, apoiar decisões estratégicas, controlar a evolução financeira e fornecer informações para auditorias e planejamento. As informações são alimentadas automaticamente por: Vendas, Compras, Contas a Receber, Contas a Pagar, Fluxo de Caixa, Contas Bancárias, Financeiro e BI.</p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li>Conferir periodicamente receitas e despesas;</li>
                <li>Atualizar diariamente os lançamentos financeiros;</li>
                <li>Revisar contas bancárias;</li>
                <li>Utilizar períodos comparativos para análise;</li>
                <li>Exportar relatórios para acompanhamento gerencial;</li>
                <li>Utilizar o Balancete como apoio ao planejamento financeiro.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">⚠️ Importante</h3>
              <p className="text-muted-foreground">O Balancete consolida informações registradas em todo o sistema. Sua confiabilidade depende da correta atualização de: Vendas, Compras, Contas a Receber, Contas a Pagar, Fluxo de Caixa e Contas Bancárias.</p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)} className="bg-gradient-primary text-primary-foreground">Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-success/10 text-success items-center justify-center mb-3"><TrendingUp className="size-5" /></div>
          <div className="text-xs text-muted-foreground">Entradas (realizado)</div>
          <div className="text-2xl font-display text-success">{brl(receitasRealizadas)}</div>
          {periodoSemMovimento ? (
            <div className="text-xs text-muted-foreground italic mt-1">Último saldo conhecido: {dateBR(cutoffDate)}</div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">Saldo consolidado até {dateBR(cutoffDate)}</div>
          )}
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-destructive/10 text-destructive items-center justify-center mb-3"><TrendingDown className="size-5" /></div>
          <div className="text-xs text-muted-foreground">Saídas (bancário)</div>
          <div className="text-2xl font-display text-destructive">{brl(totalSaidasBank)}</div>
          <div className="text-xs text-muted-foreground mt-1">Somatório de movimentações de saída</div>
        </CardContent></Card>
        <Card className={`shadow-soft ${resRealizado >= 0 ? "bg-success/5" : "bg-destructive/5"}`}><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Resultado</div>
          <div className={`text-2xl font-display ${resRealizado >= 0 ? "text-success" : "text-destructive"}`}>{brl(resRealizado)}</div>
          <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${resRealizado >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
            {resRealizado >= 0 ? "SUPERÁVIT ✅" : "DÉFICIT ⚠️"}
          </span>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft mb-6">
        <CardContent className="p-5">
          <h3 className="font-display text-lg mb-3 text-success">Receitas — Contas Bancárias</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-left">
                <th className="py-2">Conta Bancária</th><th className="text-right">Entradas período</th><th className="text-right">Saldo até {dateBR(cutoffDate)}</th>
              </tr></thead>
              <tbody>
                {receitasPorConta.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Nenhuma conta bancária ativa.</td></tr>
                )}
                {receitasPorConta.map((g) => {
                  const saldo = saldoPorConta[g.account.id] ?? 0;
                  return (
                    <tr key={g.account.id} className="border-b">
                      <td className="py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: g.account.color }} />
                          {g.account.name}
                          <span className="text-xs text-muted-foreground">({g.account.bank})</span>
                        </span>
                      </td>
                      <td className="text-right text-success">{brl(g.subtotal)}</td>
                      <td className={`text-right font-medium ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{brl(saldo)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="bg-success/10 font-medium">
                <td className="py-2">TOTAL</td>
                <td className="text-right">{brl(totalEntradas)}</td>
                <td className="text-right">{brl(totalSaldoAtual)}</td>
              </tr></tfoot>
            </table>
          </div>
        </CardContent>
      </Card>


      <Card className="shadow-soft mb-6">
        <CardContent className="p-5">
          <h3 className="font-display text-lg mb-3 text-destructive">Despesas — Contas a Pagar</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-left">
                <th className="py-2">Categoria</th><th className="text-right">Previsto</th><th className="text-right">Realizado</th><th className="text-right">Diferença</th>
              </tr></thead>
              <tbody>
                {Object.entries(despesas).length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Sem despesas no período.</td></tr>}
                {Object.entries(despesas).map(([c, v]) => (
                  <tr key={c} className="border-b"><td className="py-2 capitalize">{c}</td><td className="text-right">{brl(v.previsto)}</td><td className="text-right text-destructive">{brl(v.realizado)}</td><td className="text-right">{brl(v.previsto - v.realizado)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-destructive/10 font-medium"><td className="py-2">TOTAL DESPESAS</td><td className="text-right">{brl(totDesp.previsto)}</td><td className="text-right">{brl(totDesp.realizado)}</td><td className="text-right">{brl(totDesp.previsto - totDesp.realizado)}</td></tr></tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft mb-6">
        <CardContent className="p-5">
          <h3 className="font-display text-lg mb-3">Resultado Financeiro</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-2">(+) Saldo atual contas bancárias</td><td className="text-right text-success">{brl(totalSaldoAtual)}</td></tr>
              <tr className="border-b bg-success/5 font-medium"><td className="py-2">(=) TOTAL RECEITAS</td><td className="text-right text-success">{brl(receitasRealizadas)}</td></tr>
              <tr className="border-b"><td className="py-2">(−) Total Despesas (pagas no período)</td><td className="text-right text-destructive">{brl(totDesp.realizado)}</td></tr>
              <tr className="border-b font-display text-lg"><td className="py-3">(=) RESULTADO FINAL</td>
                <td className={`text-right ${resRealizado >= 0 ? "text-success" : "text-destructive"}`}>{brl(resRealizado)}</td>
              </tr>
              <tr><td className="py-2 text-muted-foreground">Margem %</td><td className="text-right">{margemReal.toFixed(2)}%</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <h3 className="font-display text-lg mb-3">Receitas vs Despesas</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" /><YAxis />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
                <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
                <Line type="monotone" dataKey="resultado" stroke="#ec4899" name="Resultado" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <h3 className="font-display text-lg mb-3">Distribuição de Despesas</h3>
          <div className="h-72">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} label={(e: any) => `${e.name} (${((e.percent || 0) * 100).toFixed(0)}%)`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent></Card>
      </div>

      {monthly.length > 1 && (
        <Card className="shadow-soft mb-6">
          <CardContent className="p-5">
            <h3 className="font-display text-lg mb-3">Comparativo Mensal</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-left">
                  <th className="py-2">Mês</th><th className="text-right">Receitas</th><th className="text-right">Despesas</th><th className="text-right">Resultado</th><th className="text-right">Margem</th>
                </tr></thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.key} className="border-b">
                      <td className="py-2 capitalize">{m.label}</td>
                      <td className="text-right text-success">{brl(m.receitas)}</td>
                      <td className="text-right text-destructive">{brl(m.despesas)}</td>
                      <td className={`text-right ${m.resultado >= 0 ? "text-success" : "text-destructive"}`}>{brl(m.resultado)}</td>
                      <td className="text-right">{m.receitas ? `${((m.resultado / m.receitas) * 100).toFixed(1)}%` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-muted/40 font-medium">
                  <td className="py-2">TOTAL</td>
                  <td className="text-right">{brl(totRec.realizado)}</td>
                  <td className="text-right">{brl(totDesp.realizado)}</td>
                  <td className={`text-right ${resRealizado >= 0 ? "text-success" : "text-destructive"}`}>{brl(resRealizado)}</td>
                  <td className="text-right">{margemReal.toFixed(1)}%</td>
                </tr></tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft mb-6 border-success/40 bg-success/5">
        <CardContent className="p-5">
          <h3 className="font-display text-lg mb-3 flex items-center gap-2">💰 Posição Bancária Atual</h3>
          <div className="space-y-2">
            {(bankAccounts ?? []).map((a) => {
              const saldo = saldoPorConta[a.id] ?? 0;
              return (
                <div key={a.id} className="flex items-center justify-between text-sm border-b border-dashed pb-1">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: a.color }} />
                    {a.name}
                    <span className="text-xs text-muted-foreground">({a.bank})</span>
                  </span>
                  <span className={`font-medium ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{brl(saldo)}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 font-display text-lg">
              <span>TOTAL EM CAIXA ✅</span>
              <span className={totalSaldoAtual >= 0 ? "text-success" : "text-destructive"}>{brl(totalSaldoAtual)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <CashProjection />
      </div>
    </div>
  );
}
