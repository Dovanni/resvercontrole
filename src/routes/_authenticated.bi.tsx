import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dateBR } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { Download, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bi")({
  head: () => ({ meta: [{ title: "BI — Rosé" }] }),
  component: BIPage,
});

// Paleta consistente
const C = {
  atacado: "#3b82f6", // azul
  varejo: "#ec4899", // rosa
  total: "hsl(var(--primary))",
  positive: "#10b981", // verde
  negative: "#ef4444", // vermelho
  neutral: "#94a3b8", // cinza
  amber: "#f59e0b",
  indigo: "#6366f1",
  purple: "#a855f7",
  teal: "#14b8a6",
};
const PIE_COLORS = [
  C.atacado,
  C.varejo,
  C.amber,
  C.positive,
  C.indigo,
  C.purple,
  C.teal,
  C.negative,
];

function monthKey(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(k: string) {
  const [y, m] = k.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}
function monthRange(from: string, to: string) {
  const out: string[] = [];
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const cur = new Date(a.getFullYear(), a.getMonth(), 1);
  const end = new Date(b.getFullYear(), b.getMonth(), 1);
  while (cur <= end) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

// Download de gráfico como PNG (serializa o SVG dentro do wrapper)
async function downloadChart(node: HTMLDivElement | null, filename: string) {
  if (!node) return;
  const svg = node.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.clientWidth || 800;
  const h = svg.clientHeight || 400;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([`<?xml version="1.0"?>\n${xml}`], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => {
    img.onload = () => res(null);
    img.onerror = rej;
    img.src = url;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const a = document.createElement("a");
  a.download = `${filename}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

function ChartCard({
  title,
  filename,
  height = 280,
  children,
  right,
}: {
  title: string;
  filename: string;
  height?: number;
  children: React.ReactElement;
  right?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="font-display text-base">{title}</div>
          <div className="flex items-center gap-2">
            {right}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => downloadChart(ref.current, filename)}
            >
              <Download className="size-3.5" />
            </Button>
          </div>
        </div>
        <div ref={ref} style={{ width: "100%", height }}>
          <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-8 mb-3">
      <span className="text-2xl">{icon}</span>
      <h2 className="font-display text-xl">{label}</h2>
      <div className="flex-1 h-px bg-border ml-2" />
    </div>
  );
}

function BIPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const months = useMemo(() => monthRange(from, to), [from, to]);

  // ─────────── QUERIES ───────────
  const { data: sales } = useQuery({
    queryKey: ["bi-sales", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, total, channel, sold_at, customer_id, customer_name, payment_method, status, customers(name)",
        )
        .gte("sold_at", new Date(from).toISOString())
        .lte("sold_at", new Date(to + "T23:59:59").toISOString());
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["bi-items", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "quantity, unit_cost, unit_price, products(name), sales!inner(sold_at, status)",
        )
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
        .from("receivables")
        .select("amount, received_amount, due_date, description, customers(name)")
        .lt("due_date", todayStr)
        .not("status", "in", "(recebido,cancelado)");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: payables } = useQuery({
    queryKey: ["bi-payables", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("amount, paid_amount, due_date, category, status")
        .gte("due_date", from)
        .lte("due_date", to);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: receivables } = useQuery({
    queryKey: ["bi-receivables", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("amount, received_amount, due_date, status")
        .gte("due_date", from)
        .lte("due_date", to);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: finance } = useQuery({
    queryKey: ["bi-finance", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("type, amount, entry_date, category")
        .gte("entry_date", from)
        .lte("entry_date", to);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bi-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, initial_balance");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: bankMoves } = useQuery({
    queryKey: ["bi-bank-moves", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements")
        .select("account_id, movement_date, type, amount")
        .lte("movement_date", to);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: cvd } = useQuery({
    queryKey: ["bi-cvd", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_vendas_diario")
        .select("data, loja, custo, juros_ml, frete_empresa, frete_cliente, lucro")
        .gte("data", from)
        .lte("data", to);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["bi-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock, min_stock, cost_price, sale_price");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["bi-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, customer_type, created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: cartoes } = useQuery({
    queryKey: ["bi-cartoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_credito")
        .select("id, nome, limite_total, cor, status");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: cartoesLanc } = useQuery({
    queryKey: ["bi-cartoes-lanc", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_lancamentos")
        .select("cartao_id, data, valor, categoria")
        .is("deleted_at", null)
        .gte("data", from)
        .lte("data", to);
      if (error) throw error;
      return data as any[];
    },
  });

  // ─────────── DERIVED ───────────
  const validSales = useMemo(() => (sales ?? []).filter((s) => s.status !== "cancelado"), [sales]);

  // Header cards
  const compare = useMemo(() => {
    const now = new Date();
    const curK = monthKey(now);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevK = monthKey(prev);
    let cur = 0,
      prv = 0;
    for (const s of validSales) {
      const k = monthKey(s.sold_at);
      if (k === curK) cur += Number(s.total);
      else if (k === prevK) prv += Number(s.total);
    }
    const diff = prv === 0 ? (cur > 0 ? 100 : 0) : ((cur - prv) / prv) * 100;
    return { cur, prv, diff };
  }, [validSales]);

  // 1. Evolução faturamento mensal
  const evolucaoFat = useMemo(() => {
    const base: Record<string, { month: string; atacado: number; varejo: number; total: number }> =
      {};
    months.forEach((m) => (base[m] = { month: monthLabel(m), atacado: 0, varejo: 0, total: 0 }));
    for (const s of validSales) {
      const k = monthKey(s.sold_at);
      if (!base[k]) continue;
      const v = Number(s.total);
      if (s.channel === "atacado") base[k].atacado += v;
      else base[k].varejo += v;
      base[k].total += v;
    }
    return Object.values(base);
  }, [validSales, months]);

  // Vendas por canal (mantida — usa mesma base)
  const byChannel = evolucaoFat;

  // 2. Ticket médio por canal/mês
  const ticketMedio = useMemo(() => {
    const base: Record<string, { month: string; atacado: number; varejo: number; qa: number; qv: number }> = {};
    months.forEach((m) => (base[m] = { month: monthLabel(m), atacado: 0, varejo: 0, qa: 0, qv: 0 }));
    for (const s of validSales) {
      const k = monthKey(s.sold_at);
      if (!base[k]) continue;
      const v = Number(s.total);
      if (s.channel === "atacado") {
        base[k].atacado += v;
        base[k].qa += 1;
      } else {
        base[k].varejo += v;
        base[k].qv += 1;
      }
    }
    return Object.values(base).map((r) => ({
      month: r.month,
      atacado: r.qa ? r.atacado / r.qa : 0,
      varejo: r.qv ? r.varejo / r.qv : 0,
    }));
  }, [validSales, months]);

  // 3. Forma de pagamento
  const pagamentos = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of validSales) {
      const k = s.payment_method || "Não informado";
      m[k] = (m[k] ?? 0) + Number(s.total);
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [validSales]);

  // 4. Status dos pedidos
  const statusPedidos = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sales ?? []) {
      const k = s.status || "—";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([status, qtd]) => ({ status, qtd }));
  }, [sales]);

  // Top produtos (unidades)
  const topProducts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items ?? []) {
      const name = it.products?.name ?? "—";
      m[name] = (m[name] ?? 0) + Number(it.quantity);
    }
    return Object.entries(m)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [items]);

  // 11. Top produtos por faturamento
  const topProductsFat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items ?? []) {
      const name = it.products?.name ?? "—";
      m[name] = (m[name] ?? 0) + Number(it.total);
    }
    return Object.entries(m)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [items]);

  // 12. Top produtos por margem
  const topProductsMargem = useMemo(() => {
    const m: Record<string, { receita: number; custo: number }> = {};
    for (const it of items ?? []) {
      const name = it.products?.name ?? "—";
      m[name] ??= { receita: 0, custo: 0 };
      m[name].receita += Number(it.total);
      m[name].custo += Number(it.unit_cost || 0) * Number(it.quantity);
    }
    return Object.entries(m)
      .filter(([, v]) => v.receita > 0)
      .map(([name, v]) => ({ name, margem: ((v.receita - v.custo) / v.receita) * 100 }))
      .sort((a, b) => b.margem - a.margem)
      .slice(0, 5);
  }, [items]);

  // 13. Estoque mínimo
  const lowStock = useMemo(
    () =>
      (products ?? [])
        .filter((p) => Number(p.stock) <= Number(p.min_stock || 0))
        .sort((a, b) => Number(a.stock) - Number(b.stock)),
    [products],
  );

  // Top clientes (valor)
  const topCustomers = useMemo(() => {
    const m: Record<string, { name: string; total: number; count: number }> = {};
    for (const s of validSales) {
      const name = s.customers?.name ?? s.customer_name ?? "Balcão";
      m[name] ??= { name, total: 0, count: 0 };
      m[name].total += Number(s.total);
      m[name].count += 1;
    }
    return Object.values(m);
  }, [validSales]);

  // 14. Novos clientes por mês
  const novosClientes = useMemo(() => {
    const base: Record<string, { month: string; qtd: number }> = {};
    months.forEach((m) => (base[m] = { month: monthLabel(m), qtd: 0 }));
    for (const c of customers ?? []) {
      const k = monthKey(c.created_at);
      if (base[k]) base[k].qtd += 1;
    }
    return Object.values(base);
  }, [customers, months]);

  // 15. Tipo de cliente
  const tiposClientes = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of customers ?? []) {
      const k = c.customer_type || "—";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [customers]);

  // 16. Frequência (top por nº de pedidos)
  const freqClientes = useMemo(
    () => topCustomers.sort((a, b) => b.count - a.count).slice(0, 5),
    [topCustomers],
  );

  // Inadimplência
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

  // 5. Receitas x Despesas (finance_entries)
  const recDesp = useMemo(() => {
    const base: Record<string, { month: string; receitas: number; despesas: number; resultado: number }> = {};
    months.forEach(
      (m) => (base[m] = { month: monthLabel(m), receitas: 0, despesas: 0, resultado: 0 }),
    );
    for (const f of finance ?? []) {
      const k = monthKey(f.entry_date);
      if (!base[k]) continue;
      if (f.type === "entrada") base[k].receitas += Number(f.amount);
      else base[k].despesas += Number(f.amount);
    }
    for (const k of Object.keys(base)) base[k].resultado = base[k].receitas - base[k].despesas;
    return Object.values(base);
  }, [finance, months]);

  // 6. Despesas por categoria (payables)
  const despesasCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of payables ?? []) {
      const k = p.category || "Outros";
      m[k] = (m[k] ?? 0) + Number(p.amount);
    }
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [payables]);

  // 7. Evolução saldo bancário
  const saldoEvol = useMemo(() => {
    if (!bankAccounts || !bankMoves) return [];
    const initial = bankAccounts.reduce((s, a) => s + Number(a.initial_balance || 0), 0);
    const sorted = [...bankMoves].sort((a, b) => a.movement_date.localeCompare(b.movement_date));
    const fromD = from;
    const toD = to;
    // saldo até antes de `from`
    let saldo = initial;
    let i = 0;
    while (i < sorted.length && sorted[i].movement_date < fromD) {
      const v = Number(sorted[i].amount);
      saldo += sorted[i].type === "entrada" ? v : -v;
      i++;
    }
    const out: { date: string; saldo: number }[] = [];
    const cur = new Date(fromD + "T00:00:00");
    const end = new Date(toD + "T00:00:00");
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      while (i < sorted.length && sorted[i].movement_date === ds) {
        const v = Number(sorted[i].amount);
        saldo += sorted[i].type === "entrada" ? v : -v;
        i++;
      }
      out.push({ date: ds.slice(5), saldo });
      cur.setDate(cur.getDate() + 1);
    }
    // se muitos dias, agrupar mostrando 1 a cada N
    if (out.length > 60) {
      const step = Math.ceil(out.length / 60);
      return out.filter((_, idx) => idx % step === 0);
    }
    return out;
  }, [bankAccounts, bankMoves, from, to]);

  // 8. A pagar vs a receber pendente por mês
  const pagarReceber = useMemo(() => {
    const base: Record<string, { month: string; pagar: number; receber: number }> = {};
    months.forEach((m) => (base[m] = { month: monthLabel(m), pagar: 0, receber: 0 }));
    for (const p of payables ?? []) {
      if (["pago"].includes(p.status)) continue;
      const k = monthKey(p.due_date);
      if (!base[k]) continue;
      base[k].pagar += Number(p.amount) - Number(p.paid_amount || 0);
    }
    for (const r of receivables ?? []) {
      if (["recebido", "cancelado"].includes(r.status)) continue;
      const k = monthKey(r.due_date);
      if (!base[k]) continue;
      base[k].receber += Number(r.amount) - Number(r.received_amount || 0);
    }
    return Object.values(base);
  }, [payables, receivables, months]);

  // 9 e 10. CVD por mês
  const cvdMes = useMemo(() => {
    const base: Record<
      string,
      {
        month: string;
        receber: number;
        custo: number;
        juros: number;
        freteEmp: number;
        freteCli: number;
        lucro: number;
      }
    > = {};
    months.forEach(
      (m) =>
        (base[m] = {
          month: monthLabel(m),
          receber: 0,
          custo: 0,
          juros: 0,
          freteEmp: 0,
          freteCli: 0,
          lucro: 0,
        }),
    );
    for (const r of cvd ?? []) {
      const k = monthKey(r.data);
      if (!base[k]) continue;
      base[k].receber += Number(r.loja || 0);
      base[k].custo += Number(r.custo || 0);
      base[k].juros += Number(r.juros_ml || 0);
      base[k].freteEmp += Number(r.frete_empresa || 0);
      base[k].freteCli += Number(r.frete_cliente || 0);
      base[k].lucro += Number(r.lucro || 0);
    }
    return Object.values(base);
  }, [cvd, months]);

  const cvdLucroMargem = useMemo(
    () =>
      cvdMes.map((r) => ({
        month: r.month,
        lucro: r.lucro,
        margem: r.receber > 0 ? (r.lucro * 100) / r.receber : 0,
      })),
    [cvdMes],
  );

  const cvdComposicao = useMemo(
    () =>
      cvdMes.map((r) => ({
        month: r.month,
        Receber: r.receber,
        Custo: -r.custo,
        "Juros ML": -r.juros,
        "Frete Empresa": -r.freteEmp,
        "Frete Cliente": r.freteCli,
        Lucro: r.lucro,
      })),
    [cvdMes],
  );

  // 17. Gastos por categoria (cartões) por mês
  const cartoesCatMes = useMemo(() => {
    const cats = new Set<string>();
    const base: Record<string, any> = {};
    months.forEach((m) => (base[m] = { month: monthLabel(m) }));
    for (const l of cartoesLanc ?? []) {
      const k = monthKey(l.data);
      if (!base[k]) continue;
      const cat = l.categoria || "outros";
      cats.add(cat);
      base[k][cat] = (base[k][cat] ?? 0) + Number(l.valor);
    }
    return { data: Object.values(base), cats: Array.from(cats) };
  }, [cartoesLanc, months]);

  // 18. Utilização de limite por cartão
  const cartoesLimite = useMemo(() => {
    const gasto: Record<string, number> = {};
    for (const l of cartoesLanc ?? []) {
      gasto[l.cartao_id] = (gasto[l.cartao_id] ?? 0) + Number(l.valor);
    }
    return (cartoes ?? [])
      .filter((c) => c.status !== "inativo")
      .map((c) => {
        const usado = gasto[c.id] ?? 0;
        const limite = Number(c.limite_total) || 0;
        const pct = limite > 0 ? (usado / limite) * 100 : 0;
        return { nome: c.nome, pct: Math.min(pct, 150), usado, limite };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [cartoes, cartoesLanc]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Business Intelligence"
        subtitle="Indicadores e análises do seu negócio"
      />

      {/* Filtro de período */}
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

      {/* Cards resumo */}
      <div className="grid md:grid-cols-3 gap-4 mb-2">
        <Card className="shadow-soft">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Mês atual</div>
            <div className="text-2xl font-display mt-1">{brl(compare.cur)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Mês anterior</div>
            <div className="text-2xl font-display mt-1">{brl(compare.prv)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft bg-gradient-rose">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {compare.diff >= 0 ? (
                <TrendingUp className="size-3 text-success" />
              ) : (
                <TrendingDown className="size-3 text-destructive" />
              )}
              Variação
            </div>
            <div
              className={`text-2xl font-display mt-1 ${
                compare.diff >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {compare.diff >= 0 ? "+" : ""}
              {compare.diff.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ──────── VENDAS ──────── */}
      <SectionTitle icon="📦" label="Vendas" />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Vendas por canal (mensal)" filename="vendas-canal">
          <BarChart data={byChannel}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend />
            <Bar dataKey="varejo" name="Varejo" fill={C.varejo} radius={[4, 4, 0, 0]} />
            <Bar dataKey="atacado" name="Atacado" fill={C.atacado} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Evolução do faturamento mensal" filename="evolucao-faturamento">
          <LineChart data={evolucaoFat}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="atacado" name="Atacado" stroke={C.atacado} strokeWidth={2} />
            <Line type="monotone" dataKey="varejo" name="Varejo" stroke={C.varejo} strokeWidth={2} />
            <Line type="monotone" dataKey="total" name="Total" stroke={C.total} strokeWidth={2.5} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Ticket médio por canal" filename="ticket-medio">
          <BarChart data={ticketMedio}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend />
            <Bar dataKey="atacado" name="Atacado" fill={C.atacado} radius={[4, 4, 0, 0]} />
            <Bar dataKey="varejo" name="Varejo" fill={C.varejo} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Vendas por forma de pagamento" filename="pagamento">
          <PieChart>
            <Pie data={pagamentos} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {pagamentos.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Quantidade de pedidos por status" filename="status-pedidos">
          <BarChart data={statusPedidos}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="qtd" name="Pedidos" fill={C.indigo} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top 5 produtos (unidades)" filename="top-produtos-un">
          <PieChart>
            <Pie data={topProducts} dataKey="qty" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {topProducts.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: any) => `${v} un`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ChartCard>
      </div>

      {/* ──────── FINANCEIRO ──────── */}
      <SectionTitle icon="💰" label="Financeiro" />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Receitas x Despesas (mensal)" filename="rec-desp">
          <ComposedChart data={recDesp}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend />
            <Bar dataKey="receitas" name="Receitas" fill={C.positive} radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill={C.negative} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="resultado" name="Resultado" stroke={C.indigo} strokeWidth={2.5} />
          </ComposedChart>
        </ChartCard>

        <ChartCard title="Despesas por categoria" filename="despesas-categoria">
          <PieChart>
            <Pie data={despesasCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {despesasCat.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Evolução do saldo bancário consolidado" filename="saldo-bancario">
          <LineChart data={saldoEvol}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Line type="monotone" dataKey="saldo" name="Saldo" stroke={C.total} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Contas a pagar vs a receber" filename="pagar-receber">
          <BarChart data={pagarReceber}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend />
            <Bar dataKey="pagar" name="A pagar" fill={C.negative} radius={[4, 4, 0, 0]} />
            <Bar dataKey="receber" name="A receber" fill={C.positive} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      {/* ──────── CONTROLE DE VENDAS ──────── */}
      <SectionTitle icon="📊" label="Controle de Vendas" />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Evolução de Lucro e Margem" filename="lucro-margem">
          <ComposedChart data={cvdLucroMargem}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <Tooltip
              formatter={(v: any, n: any) =>
                n === "Margem %" ? `${Number(v).toFixed(1)}%` : brl(Number(v))
              }
            />
            <Legend />
            <Bar yAxisId="left" dataKey="lucro" name="Lucro" fill={C.positive} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="margem" name="Margem %" stroke={C.amber} strokeWidth={2.5} />
          </ComposedChart>
        </ChartCard>

        <ChartCard title="Composição do resultado mensal" filename="composicao-resultado">
          <BarChart data={cvdComposicao}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Receber" stackId="pos" fill={C.atacado} />
            <Bar dataKey="Frete Cliente" stackId="pos" fill={C.teal} />
            <Bar dataKey="Custo" stackId="neg" fill={C.negative} />
            <Bar dataKey="Juros ML" stackId="neg" fill={C.amber} />
            <Bar dataKey="Frete Empresa" stackId="neg" fill={C.purple} />
            <Line type="monotone" dataKey="Lucro" stroke={C.positive} strokeWidth={2.5} />
          </BarChart>
        </ChartCard>
      </div>

      {/* ──────── PRODUTOS E ESTOQUE ──────── */}
      <SectionTitle icon="🛍️" label="Produtos e Estoque" />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Top 5 produtos por faturamento" filename="top-fat" height={300}>
          <BarChart data={topProductsFat} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Bar dataKey="total" name="Faturamento" fill={C.atacado} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top 5 produtos por margem (%)" filename="top-margem" height={300}>
          <BarChart data={topProductsMargem} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
            <Bar dataKey="margem" name="Margem" fill={C.positive} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <Card className="shadow-soft mt-4">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b font-display flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Produtos abaixo do estoque mínimo
            </span>
            <span className="text-xs text-muted-foreground">{lowStock.length} itens</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Repor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStock.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Tudo em ordem. 🎉
                  </TableCell>
                </TableRow>
              )}
              {lowStock.map((p) => {
                const repor = Math.max(0, Number(p.min_stock || 0) - Number(p.stock));
                return (
                  <TableRow key={p.id} className="bg-destructive/5">
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {p.stock}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.min_stock}</TableCell>
                    <TableCell className="text-right font-medium">{repor}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ──────── CLIENTES ──────── */}
      <SectionTitle icon="👥" label="Clientes" />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Novos clientes por mês" filename="novos-clientes">
          <BarChart data={novosClientes}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="qtd" name="Novos" fill={C.varejo} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Distribuição por tipo" filename="tipos-clientes">
          <PieChart>
            <Pie data={tiposClientes} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {tiposClientes.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Top 5 clientes por nº de pedidos" filename="freq-clientes" height={300}>
          <BarChart data={freqClientes} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip />
            <Bar dataKey="count" name="Pedidos" fill={C.indigo} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <Card className="shadow-soft">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b font-display">Top 5 clientes por faturamento</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.slice(0, 5).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                      Sem vendas no período.
                    </TableCell>
                  </TableRow>
                )}
                {topCustomers
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 5)
                  .map((c) => (
                    <TableRow key={c.name}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-right font-medium">{brl(c.total)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Inadimplência */}
      <Card className="shadow-soft mt-4">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b font-display flex items-center justify-between">
            <span>Inadimplência</span>
            <span className="text-xs text-destructive font-normal">
              {brl(overdueAgg.reduce((s, o) => s + o.total, 0))}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vence desde</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueAgg.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Sem inadimplência. 🎉
                  </TableCell>
                </TableRow>
              )}
              {overdueAgg.map((o) => (
                <TableRow key={o.name}>
                  <TableCell>
                    {o.name}{" "}
                    <span className="text-xs text-muted-foreground">({o.count})</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dateBR(o.oldest)}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {brl(o.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ──────── CARTÕES DE CRÉDITO ──────── */}
      <SectionTitle icon="💳" label="Cartões de Crédito" />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Gastos por categoria (todos cartões)" filename="cartoes-categoria">
          <BarChart data={cartoesCatMes.data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {cartoesCatMes.cats.map((cat, i) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="g"
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Utilização de limite por cartão"
          filename="cartoes-limite"
          height={Math.max(220, cartoesLimite.length * 44 + 60)}
        >
          <BarChart data={cartoesLimite} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip
              formatter={(v: any, _n: any, p: any) =>
                `${Number(v).toFixed(1)}% — ${brl(p.payload.usado)} / ${brl(p.payload.limite)}`
              }
            />
            <Bar dataKey="pct" name="Utilização" radius={[0, 4, 4, 0]}>
              {cartoesLimite.map((row, i) => (
                <Cell key={i} fill={row.pct > 80 ? C.negative : row.pct > 50 ? C.amber : C.positive} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
