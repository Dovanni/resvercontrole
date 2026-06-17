import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { TrendingUp, TrendingDown, ShoppingBag, Wallet, AlertTriangle, ChevronDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Rosé" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [sales, finance, products, items] = await Promise.all([
        supabase.from("sales").select("id,total,sold_at,customer_name,channel").gte("sold_at", monthStart).order("sold_at", { ascending: false }),
        supabase.from("finance_entries").select("type,amount,entry_date").gte("entry_date", monthStart),
        supabase.from("products").select("id,name,stock,min_stock"),
        supabase.from("sale_items").select("quantity,unit_price,unit_cost,product_id,products(name)").gte("created_at", monthStart),
      ]);

      const salesRows = sales.data ?? [];
      const totalRevenue = salesRows.reduce((s, r) => s + Number(r.total), 0);
      const totalIncome = (finance.data ?? []).filter(f => f.type === "income").reduce((s, r) => s + Number(r.amount), 0);
      const totalExpense = (finance.data ?? []).filter(f => f.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
      const totalCost = (items.data ?? []).reduce((s, r) => s + Number(r.unit_cost) * r.quantity, 0);
      const profit = totalRevenue - totalCost;
      const salesCount = salesRows.length;

      // ticket médio separado por canal
      const atac = salesRows.filter(s => s.channel === "atacado");
      const varj = salesRows.filter(s => s.channel === "varejo");
      const ticketAtacado = atac.length ? atac.reduce((s, r) => s + Number(r.total), 0) / atac.length : 0;
      const ticketVarejo = varj.length ? varj.reduce((s, r) => s + Number(r.total), 0) / varj.length : 0;

      // top products by qty
      const map = new Map<string, { name: string; qty: number; revenue: number }>();
      (items.data ?? []).forEach((it: any) => {
        const key = it.product_id;
        const cur = map.get(key) ?? { name: it.products?.name ?? "—", qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += Number(it.unit_price) * it.quantity;
        map.set(key, cur);
      });
      const topProducts = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

      // daily revenue chart (last 14 days)
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      salesRows.forEach(s => {
        const k = s.sold_at.slice(0, 10);
        if (k in days) days[k] += Number(s.total);
      });
      const chart = Object.entries(days).map(([d, v]) => ({
        day: new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        Faturamento: Number(v.toFixed(2)),
      }));

      const lowStock = (products.data ?? []).filter(p => p.stock <= p.min_stock);

      return {
        totalRevenue, profit, salesCount,
        ticketAtacado, ticketVarejo,
        totalIncome, totalExpense, balance: totalIncome - totalExpense,
        topProducts, chart, lowStock, recentSales: salesRows.slice(0, 5),
      };
    },
  });

  if (isLoading || !data) {
    return <div className="p-8 text-muted-foreground">Carregando…</div>;
  }

  const kpis = [
    { label: "Faturamento do mês", value: brl(data.totalRevenue), icon: TrendingUp, accent: "bg-gradient-primary text-primary-foreground" },
    { label: "Saldo de caixa", value: brl(data.balance), icon: Wallet, accent: "bg-gradient-gold text-gold-foreground" },
    { label: "Ticket médio — Varejo", value: brl(data.ticketVarejo), icon: ShoppingBag, accent: "bg-accent text-accent-foreground" },
    { label: "Ticket médio — Atacado", value: brl(data.ticketAtacado), icon: ShoppingBag, accent: "bg-secondary text-secondary-foreground" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" subtitle="Visão geral do mês atual" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <Card key={k.label} className="shadow-soft">
            <CardContent className="p-5">
              <div className={`inline-flex size-10 rounded-xl items-center justify-center mb-3 ${k.accent}`}>
                <k.icon className="size-5" />
              </div>
              <div className="text-2xl font-display">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader><CardTitle className="font-display">Faturamento diário</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Bar dataKey="Faturamento" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="font-display">Caixa do mês</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Entradas" value={brl(data.totalIncome)} icon={<TrendingUp className="size-4 text-success" />} />
            <Row label="Saídas" value={brl(data.totalExpense)} icon={<TrendingDown className="size-4 text-destructive" />} />
            <div className="border-t pt-3">
              <Row label="Saldo" value={brl(data.balance)} strong />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="font-display">Top produtos</CardTitle></CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem vendas ainda.</p>
            ) : (
              <ul className="space-y-3">
                {data.topProducts.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-7 rounded-full bg-gradient-rose text-primary text-xs font-semibold flex items-center justify-center">{i + 1}</div>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium">{brl(p.revenue)}</div>
                      <div className="text-xs text-muted-foreground">{p.qty} un.</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="size-4 text-gold" /> Estoque baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tudo certo com o estoque ✨</p>
            ) : (
              <ul className="space-y-2">
                {data.lowStock.map(p => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="text-destructive font-medium">{p.stock} un.</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, icon, strong }: { label: string; value: string; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className={strong ? "font-display text-xl" : "font-medium"}>{value}</div>
    </div>
  );
}
