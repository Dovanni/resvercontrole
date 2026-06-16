import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, dateBR } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bi")({
  head: () => ({ meta: [{ title: "BI — Rosé" }] }),
  component: BIPage,
});

const COLORS = ["hsl(var(--primary))", "#f59e0b", "#10b981", "#6366f1", "#ec4899"];

function monthKey(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function BIPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const { data: sales } = useQuery({
    queryKey: ["bi-sales", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, channel, sold_at, customer_id, customer_name, customers(name)")
        .gte("sold_at", new Date(from).toISOString())
        .lte("sold_at", new Date(to + "T23:59:59").toISOString())
        .neq("status", "cancelado");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["bi-items", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("quantity, total, products(name), sales!inner(sold_at, status)")
        .gte("sales.sold_at", new Date(from).toISOString())
        .lte("sales.sold_at", new Date(to + "T23:59:59").toISOString())
        .neq("sales.status", "cancelado");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: overdue } = useQuery({
    queryKey: ["bi-overdue"],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("receivables" as any)
        .select("amount, received_amount, due_date, description, customers(name)")
        .lt("due_date", todayStr)
        .neq("status", "recebido")
        .neq("status", "cancelado");
      if (error) throw error;
      return data as any[];
    },
  });

  const byChannel = useMemo(() => {
    const map: Record<string, { month: string; atacado: number; varejo: number }> = {};
    for (const s of sales ?? []) {
      const k = monthKey(s.sold_at);
      map[k] ??= { month: k, atacado: 0, varejo: 0 };
      if (s.channel === "atacado") map[k].atacado += Number(s.total);
      else map[k].varejo += Number(s.total);
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [sales]);

  const topProducts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items ?? []) {
      const name = it.products?.name ?? "—";
      m[name] = (m[name] ?? 0) + Number(it.quantity);
    }
    return Object.entries(m).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [items]);

  const topCustomers = useMemo(() => {
    const m: Record<string, { name: string; total: number }> = {};
    for (const s of sales ?? []) {
      const name = s.customers?.name ?? s.customer_name ?? "Balcão";
      m[name] ??= { name, total: 0 };
      m[name].total += Number(s.total);
    }
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  const compare = useMemo(() => {
    const now = new Date();
    const curK = monthKey(now);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevK = monthKey(prev);
    let cur = 0, prv = 0;
    for (const s of sales ?? []) {
      const k = monthKey(s.sold_at);
      if (k === curK) cur += Number(s.total);
      else if (k === prevK) prv += Number(s.total);
    }
    const diff = prv === 0 ? (cur > 0 ? 100 : 0) : ((cur - prv) / prv) * 100;
    return { cur, prv, diff };
  }, [sales]);

  const overdueAgg = useMemo(() => {
    const m: Record<string, { name: string; total: number; count: number; oldest: string }> = {};
    for (const r of overdue ?? []) {
      const name = r.customers?.name ?? "—";
      const remaining = Number(r.amount) - Number(r.received_amount);
      m[name] ??= { name, total: 0, count: 0, oldest: r.due_date };
      m[name].total += remaining;
      m[name].count += 1;
      if (r.due_date < m[name].oldest) m[name].oldest = r.due_date;
    }
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [overdue]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Business Intelligence" subtitle="Indicadores e análises do seu negócio" />

      <Card className="shadow-soft mb-6">
        <CardContent className="p-4 grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Mês atual</div>
          <div className="text-2xl font-display mt-1">{brl(compare.cur)}</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Mês anterior</div>
          <div className="text-2xl font-display mt-1">{brl(compare.prv)}</div>
        </CardContent></Card>
        <Card className="shadow-soft bg-gradient-rose"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {compare.diff >= 0 ? <TrendingUp className="size-3 text-success" /> : <TrendingDown className="size-3 text-destructive" />}
            Variação
          </div>
          <div className={`text-2xl font-display mt-1 ${compare.diff >= 0 ? "text-success" : "text-destructive"}`}>
            {compare.diff >= 0 ? "+" : ""}{compare.diff.toFixed(1)}%
          </div>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="font-display text-lg mb-4">Vendas por canal (mensal)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byChannel}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
                <Bar dataKey="varejo" name="Varejo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="atacado" name="Atacado" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>

        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="font-display text-lg mb-4">Top 5 produtos (unidades)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={topProducts} dataKey="qty" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `${v} un`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft"><CardContent className="p-0">
          <div className="px-5 py-4 border-b font-display">Top 5 clientes por faturamento</div>
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Faturamento</TableHead></TableRow></TableHeader>
            <TableBody>
              {topCustomers.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Sem vendas no período.</TableCell></TableRow>}
              {topCustomers.map((c) => (
                <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell className="text-right font-medium">{brl(c.total)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Card className="shadow-soft"><CardContent className="p-0">
          <div className="px-5 py-4 border-b font-display flex items-center justify-between">
            <span>Inadimplência</span>
            <span className="text-xs text-destructive font-normal">{brl(overdueAgg.reduce((s, o) => s + o.total, 0))}</span>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Vence desde</TableHead><TableHead className="text-right">Em aberto</TableHead></TableRow></TableHeader>
            <TableBody>
              {overdueAgg.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Sem inadimplência. 🎉</TableCell></TableRow>}
              {overdueAgg.map((o) => (
                <TableRow key={o.name}>
                  <TableCell>{o.name} <span className="text-xs text-muted-foreground">({o.count})</span></TableCell>
                  <TableCell className="text-muted-foreground">{dateBR(o.oldest)}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{brl(o.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>
  );
}
