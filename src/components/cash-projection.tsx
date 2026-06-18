import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { AlertTriangle, ArrowDown, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Area, ComposedChart,
} from "recharts";

type Horizon = "6m" | "12m" | "ano";

export function CashProjection({ compact = false }: { compact?: boolean }) {
  const [horizon, setHorizon] = useState<Horizon>("6m");

  const { data: movs } = useQuery({
    queryKey: ["cash-projection-movs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements" as any)
        .select("account_id, type, amount");
      if (error) throw error;
      return (data ?? []) as unknown as { account_id: string; type: string; amount: number }[];
    },
  });

  const { data: payables } = useQuery({
    queryKey: ["cash-projection-pay"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("amount, due_date, status")
        .in("status", ["pendente", "atrasado"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saldoAtual = useMemo(
    () => (movs ?? []).reduce((s, m) => s + (m.type === "entrada" ? Number(m.amount) : -Number(m.amount)), 0),
    [movs]
  );

  const months = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth();
    let count = 6;
    if (horizon === "12m") count = 12;
    else if (horizon === "ano") count = Math.max(1, 12 - m);

    // Despesas por mês-chave
    const desp: Record<string, number> = {};
    for (const p of (payables ?? []) as any[]) {
      const d = new Date(p.due_date + "T00:00:00");
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      desp[k] = (desp[k] ?? 0) + Number(p.amount || 0);
    }

    const rows: { key: string; label: string; despesas: number; saldo: number }[] = [];
    let saldo = saldoAtual;
    for (let i = 0; i < count; i++) {
      const d = new Date(y, m + i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const dv = desp[k] ?? 0;
      saldo = saldo - dv;
      rows.push({
        key: k,
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        despesas: dv,
        saldo,
      });
    }
    return rows;
  }, [saldoAtual, payables, horizon]);

  const primeiroNegativo = months.find((m) => m.saldo < 0);
  const chartData = useMemo(() => [
    { label: "Atual", saldo: saldoAtual, despesas: 0 },
    ...months.map((m) => ({ label: m.label, saldo: m.saldo, despesas: m.despesas })),
  ], [saldoAtual, months]);

  const QBtn = ({ h, children }: { h: Horizon; children: React.ReactNode }) => (
    <Button size="sm" variant={horizon === h ? "default" : "outline"}
      onClick={() => setHorizon(h)}
      className={horizon === h ? "bg-gradient-primary text-primary-foreground" : ""}>
      {children}
    </Button>
  );

  return (
    <Card className="shadow-soft">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" /> Projeção de Caixa Mensal
            </h3>
            <p className="text-xs text-muted-foreground">
              Saldo atual descontando despesas previstas mês a mês
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Projetar até:</span>
            <QBtn h="6m">6 meses</QBtn>
            <QBtn h="12m">12 meses</QBtn>
            <QBtn h="ano">Fim do ano</QBtn>
          </div>
        </div>

        {primeiroNegativo && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <strong>Atenção: saldo negativo previsto em {primeiroNegativo.label} de {brl(primeiroNegativo.saldo)}.</strong>
              <div className="text-muted-foreground text-xs mt-0.5">
                Revise suas despesas ou reforce o caixa.
              </div>
            </div>
          </div>
        )}

        <div className={compact ? "grid grid-cols-2 sm:grid-cols-3 gap-2" : "flex flex-col items-center gap-0"}>
          <ProjCard label="ATUAL" value={saldoAtual} highlight compact={compact} />
          {months.map((m, i) => (
            <>
              {!compact && <ArrowDown key={`a-${m.key}`} className="size-4 text-muted-foreground my-0.5" />}
              <ProjCard key={m.key} label={`SALDO ${m.label.toUpperCase()}`} value={m.saldo} compact={compact}
                hint={m.despesas > 0 ? `− ${brl(m.despesas)} despesas` : undefined} />
            </>
          ))}
        </div>

        <div className="h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any, n: any) => [brl(Number(v)), n === "saldo" ? "Saldo" : "Despesas"]}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
              <Area type="monotone" dataKey={(d: any) => (d.saldo < 0 ? d.saldo : 0)} name="Déficit" fill="#ef4444" stroke="none" fillOpacity={0.25} />
              <Line type="monotone" dataKey="saldo" name="Saldo projetado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjCard({ label, value, highlight, hint, compact }: {
  label: string; value: number; highlight?: boolean; hint?: string; compact?: boolean;
}) {
  const negative = value < 0;
  const base = compact ? "w-full" : "w-full max-w-sm";
  return (
    <div
      className={[
        base,
        "rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition",
        highlight ? "bg-primary text-primary-foreground border-primary" :
          negative ? "bg-destructive/10 border-destructive/40" : "bg-background",
      ].join(" ")}
    >
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-right">
        <div className={[
          "font-display text-lg tabular-nums",
          highlight ? "" : negative ? "text-destructive" : "text-foreground",
        ].join(" ")}>
          {brl(value)}
        </div>
        {hint && <div className="text-[10px] opacity-70">{hint}</div>}
      </div>
    </div>
  );
}
