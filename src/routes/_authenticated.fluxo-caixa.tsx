import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowDownRight, ArrowUpRight, Wallet, Landmark } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/fluxo-caixa")({
  head: () => ({ meta: [{ title: "Fluxo de caixa — Rosé" }] }),
  component: CashFlowPage,
});

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function CashFlowPage() {
  const today = new Date();
  const startPast = new Date(today); startPast.setDate(today.getDate() - 30);
  const endFuture = new Date(today); endFuture.setDate(today.getDate() + 15);

  const { data: finance } = useQuery({
    queryKey: ["cashflow", "finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("type,amount,entry_date,description,category")
        .gte("entry_date", startPast.toISOString())
        .lte("entry_date", today.toISOString())
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: futurePayables } = useQuery({
    queryKey: ["cashflow", "payables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("amount,due_date,description,status")
        .neq("status", "pago")
        .neq("status", "cancelado")
        .gte("due_date", isoDay(today))
        .lte("due_date", isoDay(endFuture));
      if (error) throw error;
      return data;
    },
  });

  const { data: futureReceivables } = useQuery({
    queryKey: ["cashflow", "receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables" as any)
        .select("amount,received_amount,due_date,description,status")
        .neq("status", "recebido")
        .neq("status", "cancelado")
        .gte("due_date", isoDay(today))
        .lte("due_date", isoDay(endFuture));
      if (error) throw error;
      return data as any[];
    },
  });

  const chart = useMemo(() => {
    // Build day buckets
    const days: Record<string, { date: string; income: number; expense: number; projIncome: number; projExpense: number }> = {};
    const cursor = new Date(startPast);
    while (cursor <= endFuture) {
      const k = isoDay(cursor);
      days[k] = { date: k, income: 0, expense: 0, projIncome: 0, projExpense: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const e of finance ?? []) {
      const k = isoDay(new Date(e.entry_date));
      if (!days[k]) continue;
      if (e.type === "income") days[k].income += Number(e.amount);
      else days[k].expense += Number(e.amount);
    }
    for (const p of futurePayables ?? []) {
      const k = p.due_date;
      if (!days[k]) continue;
      days[k].projExpense += Number(p.amount);
    }
    for (const r of futureReceivables ?? []) {
      const k = r.due_date;
      if (!days[k]) continue;
      const remaining = Number(r.amount) - Number(r.received_amount);
      days[k].projIncome += remaining;
    }

    const todayKey = isoDay(today);
    let balance = 0;
    const series = Object.values(days)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const net = d.income - d.expense + d.projIncome - d.projExpense;
        balance += net;
        const isFuture = d.date > todayKey;
        return {
          date: d.date,
          label: dateBR(d.date).slice(0, 5),
          income: d.income,
          expense: d.expense,
          saldoReal: isFuture ? null : balance,
          saldoProjetado: isFuture ? balance : null,
          isFuture,
        };
      });

    // ensure continuity at today
    const todayIdx = series.findIndex((s) => s.date === todayKey);
    if (todayIdx >= 0) (series[todayIdx] as any).saldoProjetado = series[todayIdx].saldoReal;

    return series;
  }, [finance, futurePayables, futureReceivables]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of finance ?? []) {
      if (e.type === "income") income += Number(e.amount);
      else expense += Number(e.amount);
    }
    return { income, expense, balance: income - expense };
  }, [finance]);

  const daily = useMemo(() => chart.filter((d) => !d.isFuture).slice(-15).reverse(), [chart]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Fluxo de caixa" subtitle="Visão diária com projeção dos próximos 15 dias" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-success/10 text-success items-center justify-center mb-3"><ArrowUpRight className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.income)}</div>
          <div className="text-xs text-muted-foreground mt-1">Entradas (30d)</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-destructive/10 text-destructive items-center justify-center mb-3"><ArrowDownRight className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.expense)}</div>
          <div className="text-xs text-muted-foreground mt-1">Saídas (30d)</div>
        </CardContent></Card>
        <Card className="shadow-soft bg-gradient-rose"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-primary/10 text-primary items-center justify-center mb-3"><Wallet className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.balance)}</div>
          <div className="text-xs text-muted-foreground mt-1">Saldo período</div>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft mb-6">
        <CardContent className="p-5">
          <div className="font-display text-lg mb-4">Saldo acumulado — 30 dias passados + 15 dias projetados</div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any) => (v == null ? "—" : brl(Number(v)))}
                  labelFormatter={(l) => `Dia ${l}`}
                />
                <Legend />
                <ReferenceLine x={dateBR(isoDay(today)).slice(0, 5)} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: "Hoje", position: "top", fill: "hsl(var(--primary))", fontSize: 11 }} />
                <Line type="monotone" dataKey="saldoReal" name="Saldo real" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="saldoProjetado" name="Projeção" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b font-display">Movimentação diária (últimos 15 dias)</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Saldo acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Sem movimentações no período.</TableCell></TableRow>
              )}
              {daily.map((d) => {
                const net = d.income - d.expense;
                return (
                  <TableRow key={d.date}>
                    <TableCell>{dateBR(d.date)}</TableCell>
                    <TableCell className="text-right text-success">{brl(d.income)}</TableCell>
                    <TableCell className="text-right text-destructive">{brl(d.expense)}</TableCell>
                    <TableCell className={`text-right font-medium ${net >= 0 ? "text-success" : "text-destructive"}`}>{brl(net)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(d.saldoReal ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
