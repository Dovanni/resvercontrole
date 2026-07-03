import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Download, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/curva-abc")({
  head: () => ({ meta: [{ title: "Curva ABC — Rosé" }] }),
  component: CurvaABCPage,
});

type Classe = "A" | "B" | "C";
const CLASS_COLORS: Record<Classe, string> = { A: "#16a34a", B: "#f59e0b", C: "#ef4444" };
const CLASS_ROW_BG: Record<Classe, string> = {
  A: "bg-green-50 dark:bg-green-950/20",
  B: "bg-amber-50 dark:bg-amber-950/20",
  C: "bg-red-50 dark:bg-red-950/20",
};

function classify(pctAcum: number): Classe {
  if (pctAcum <= 80) return "A";
  if (pctAcum <= 95) return "B";
  return "C";
}

function ClassBadge({ c }: { c: Classe }) {
  const cls =
    c === "A"
      ? "bg-green-600 text-white hover:bg-green-600"
      : c === "B"
        ? "bg-amber-500 text-white hover:bg-amber-500"
        : "bg-red-500 text-white hover:bg-red-500";
  return <Badge className={cls}>Classe {c}</Badge>;
}

type Row = {
  key: string;
  label: string;
  meta: string;
  qty: number;
  value: number;
  orders: number;
};

function buildABC(rows: Row[], metric: "value" | "qty") {
  const sorted = [...rows].sort((a, b) => (metric === "value" ? b.value - a.value : b.qty - a.qty));
  const total = sorted.reduce((s, r) => s + (metric === "value" ? r.value : r.qty), 0);
  let acc = 0;
  return sorted.map((r, i) => {
    const v = metric === "value" ? r.value : r.qty;
    const pct = total > 0 ? (v / total) * 100 : 0;
    acc += pct;
    return { ...r, pos: i + 1, pct, pctAcum: acc, classe: classify(acc), total };
  });
}

function presetRange(preset: string): { from: string; to: string } | null {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "mes") {
    const f = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(f), to: iso(today) };
  }
  if (preset === "3m") {
    const f = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { from: iso(f), to: iso(today) };
  }
  if (preset === "6m") {
    const f = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { from: iso(f), to: iso(today) };
  }
  if (preset === "ano") {
    const f = new Date(today.getFullYear(), 0, 1);
    return { from: iso(f), to: iso(today) };
  }
  return null;
}

function CurvaABCPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [channel, setChannel] = useState<"todos" | "atacado" | "varejo">("todos");
  const [applied, setApplied] = useState({ from: defaultFrom, to: defaultTo, channel: "todos" as typeof channel });
  const [preset, setPreset] = useState("3m");
  const [showHelp, setShowHelp] = useState(false);


  const { data: sales } = useQuery({
    queryKey: ["abc-sales", applied],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("id, total, channel, sold_at, customer_id, customer_name, customers(name)")
        .gte("sold_at", new Date(applied.from).toISOString())
        .lte("sold_at", new Date(applied.to + "T23:59:59").toISOString())
        .neq("status", "cancelado")
        .neq("channel", "recursos_financeiros");
      if (applied.channel !== "todos") q = q.eq("channel", applied.channel);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["abc-items", applied],
    queryFn: async () => {
      let q = supabase
        .from("sale_items")
        .select("product_id, quantity, unit_price, products(name, category), sales!inner(sold_at, status, channel)")
        .gte("sales.sold_at", new Date(applied.from).toISOString())
        .lte("sales.sold_at", new Date(applied.to + "T23:59:59").toISOString())
        .neq("sales.status", "cancelado")
        .neq("sales.channel", "recursos_financeiros");
      if (applied.channel !== "todos") q = q.eq("sales.channel", applied.channel);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const clientRows: Row[] = useMemo(() => {
    const m: Record<string, Row & { channel: string }> = {};
    for (const s of sales ?? []) {
      const key = s.customer_id ?? `bal:${s.customer_name ?? "Balcão"}`;
      const name = s.customers?.name ?? s.customer_name ?? "Balcão";
      m[key] ??= { key, label: name, meta: s.channel ?? "—", qty: 0, value: 0, orders: 0, channel: s.channel };
      m[key].value += Number(s.total);
      m[key].qty += 1;
      m[key].orders += 1;
    }
    return Object.values(m);
  }, [sales]);

  const productRows: Row[] = useMemo(() => {
    const m: Record<string, Row & { unit: number; n: number }> = {};
    for (const it of items ?? []) {
      const key = it.product_id ?? `n:${it.products?.name ?? "—"}`;
      const name = it.products?.name ?? "—";
      const cat = it.products?.category ?? "—";
      m[key] ??= { key, label: name, meta: cat, qty: 0, value: 0, orders: 0, unit: 0, n: 0 };
      m[key].qty += Number(it.quantity);
      m[key].value += Number(it.quantity) * Number(it.unit_price ?? 0);
      m[key].unit += Number(it.unit_price ?? 0);
      m[key].n += 1;
    }
    return Object.values(m).map((r) => ({ ...r, orders: r.n ? r.unit / r.n : 0 }));
  }, [items]);

  const applyPreset = (p: string) => {
    setPreset(p);
    const r = presetRange(p);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Curva ABC" subtitle="Classificação A/B/C de clientes e produtos por faturamento ou quantidade" />

      <Card className="shadow-soft mb-6">
        <CardContent className="p-4 grid md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês atual</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="ano">Ano atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Canal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="atacado">Atacado</SelectItem>
                <SelectItem value="varejo">Varejo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setApplied({ from, to, channel })}>Aplicar filtro</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-4">
          <ABCSection
            rows={clientRows}
            kind="clientes"
            period={`${applied.from}_${applied.to}`}
            columnsValue={["Cliente", "Canal", "Nº Pedidos", "Valor Total (R$)"]}
            columnsQty={["Cliente", "Canal", "Qtd Compras", "Ticket Médio (R$)"]}
            renderValueRow={(r) => [r.label, r.meta, String(r.orders), brl(r.value)]}
            renderQtyRow={(r) => [r.label, r.meta, String(r.qty), brl(r.qty ? r.value / r.qty : 0)]}
          />
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <ABCSection
            rows={productRows}
            kind="produtos"
            period={`${applied.from}_${applied.to}`}
            columnsValue={["Produto", "Categoria", "Qtd Vendida", "Valor Total (R$)"]}
            columnsQty={["Produto", "Categoria", "Qtd Vendida", "Valor Unitário (R$)"]}
            renderValueRow={(r) => [r.label, r.meta, String(r.qty), brl(r.value)]}
            renderQtyRow={(r) => [r.label, r.meta, String(r.qty), brl(r.orders)]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ABCSection({
  rows,
  kind,
  period,
  columnsValue,
  columnsQty,
  renderValueRow,
  renderQtyRow,
}: {
  rows: Row[];
  kind: "clientes" | "produtos";
  period: string;
  columnsValue: string[];
  columnsQty: string[];
  renderValueRow: (r: Row) => string[];
  renderQtyRow: (r: Row) => string[];
}) {
  const [metric, setMetric] = useState<"value" | "qty">("value");
  const classified = useMemo(() => buildABC(rows, metric), [rows, metric]);
  const totalValue = classified.reduce((s, r) => s + r.value, 0);
  const totalQty = classified.reduce((s, r) => s + r.qty, 0);
  const totalCount = classified.length || 1;

  const summary = (["A", "B", "C"] as Classe[]).map((c) => {
    const items = classified.filter((r) => r.classe === c);
    const val = items.reduce((s, r) => s + r.value, 0);
    return {
      c,
      count: items.length,
      pctCount: (items.length / totalCount) * 100,
      value: val,
      pctValue: totalValue ? (val / totalValue) * 100 : 0,
    };
  });

  const top10 = classified.slice(0, 10).map((r) => ({
    name: r.label.length > 22 ? r.label.slice(0, 22) + "…" : r.label,
    valor: metric === "value" ? r.value : r.qty,
    classe: r.classe,
  }));

  const cols = metric === "value" ? columnsValue : columnsQty;
  const renderRow = metric === "value" ? renderValueRow : renderQtyRow;

  const exportXlsx = () => {
    const header = ["Posição", ...cols, "% Individual", "% Acumulado", "Classe ABC"];
    const data = classified.map((r) => [r.pos, ...renderRow(r), `${r.pct.toFixed(2)}%`, `${r.pctAcum.toFixed(2)}%`, r.classe]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Curva ABC");
    XLSX.writeFile(wb, `curva_abc_${kind}_${period}.xlsx`);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <Tabs value={metric} onValueChange={(v) => setMetric(v as any)}>
          <TabsList>
            <TabsTrigger value="value">Por Valor (R$)</TabsTrigger>
            <TabsTrigger value="qty">Por {kind === "clientes" ? "Quantidade de Compras" : "Quantidade Vendida"}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={exportXlsx}>
          <Download className="size-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {summary.map((s) => (
          <Card key={s.c} className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <ClassBadge c={s.c} />
                <div className="text-xs text-muted-foreground">{s.count} {kind === "clientes" ? "clientes" : "produtos"} ({s.pctCount.toFixed(1)}%)</div>
              </div>
              <div className="text-2xl font-display mt-2">{brl(s.value)}</div>
              <div className="text-xs text-muted-foreground">{s.pctValue.toFixed(1)}% do faturamento</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft mb-4">
        <CardContent className="p-5">
          <div className="font-display text-lg mb-4">Top 10 — {metric === "value" ? "Valor" : "Quantidade"}</div>
          <div style={{ height: Math.max(240, top10.length * 32) }}>
            <ResponsiveContainer>
              <BarChart data={top10} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => metric === "value" ? `R$${(v / 1000).toFixed(0)}k` : String(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v: any) => metric === "value" ? brl(Number(v)) : `${v}`} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {top10.map((r, i) => <Cell key={i} fill={CLASS_COLORS[r.classe]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pos.</TableHead>
                {cols.map((c) => <TableHead key={c}>{c}</TableHead>)}
                <TableHead className="text-right">% Ind.</TableHead>
                <TableHead className="text-right">% Acum.</TableHead>
                <TableHead>Classe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classified.length === 0 && (
                <TableRow><TableCell colSpan={cols.length + 4} className="text-center py-8 text-muted-foreground">Sem dados no período.</TableCell></TableRow>
              )}
              {classified.map((r) => {
                const cells = renderRow(r);
                return (
                  <TableRow key={r.key} className={CLASS_ROW_BG[r.classe]}>
                    <TableCell className="font-medium">{r.pos}</TableCell>
                    {cells.map((v, i) => (
                      <TableCell key={i} className={i === cells.length - 1 ? "font-medium" : ""}>{v}</TableCell>
                    ))}
                    <TableCell className="text-right">{r.pct.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{r.pctAcum.toFixed(2)}%</TableCell>
                    <TableCell><ClassBadge c={r.classe} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
