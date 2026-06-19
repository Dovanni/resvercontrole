import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowDownRight, ArrowUpRight, Wallet, Landmark } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CashProjection } from "@/components/cash-projection";

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
  const [accountFilter, setAccountFilter] = useState<string>("todas");
  const [onlyMovementDays, setOnlyMovementDays] = useState(true);

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id,name,bank,color,initial_balance,status,created_at")
        .eq("status", "ativa")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string; initial_balance: number; status: string; created_at: string }[];
    },
  });

  const { data: bankMovements } = useQuery({
    queryKey: ["cashflow", "bank-movements-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements" as any)
        .select("account_id,destination_account_id,type,amount,movement_date,description,category,origin");
      if (error) throw error;
      return (data ?? []) as unknown as { account_id: string; destination_account_id: string | null; type: string; amount: number; movement_date: string; description: string; category: string; origin: string | null }[];
    },
  });

  // Saldo consolidado (todas as movimentações)
  const bankBalances = useMemo(() => {
    const accountsWithInitialMovement = new Set(
      (bankMovements ?? []).filter((m) => m.origin === "saldo_inicial").map((m) => m.account_id)
    );
    const map: Record<string, number> = {};
    for (const a of bankAccounts ?? []) map[a.id] = accountsWithInitialMovement.has(a.id) ? 0 : Number(a.initial_balance ?? 0);
    for (const m of bankMovements ?? []) {
      const amt = Number(m.amount);
      if (m.type === "entrada") map[m.account_id] = (map[m.account_id] ?? 0) + amt;
      else if (m.type === "saida") map[m.account_id] = (map[m.account_id] ?? 0) - amt;
      else if (m.type === "transferencia") {
        map[m.account_id] = (map[m.account_id] ?? 0) - amt;
        if (m.destination_account_id) map[m.destination_account_id] = (map[m.destination_account_id] ?? 0) + amt;
      }
    }
    return map;
  }, [bankAccounts, bankMovements]);

  const totalBankBalance = useMemo(
    () => (bankAccounts ?? []).reduce((s, a) => s + (bankBalances[a.id] ?? 0), 0),
    [bankAccounts, bankBalances]
  );

  // Movimentações filtradas pela conta selecionada
  const filteredMovements = useMemo(() => {
    const accountsWithInitialMovement = new Set(
      (bankMovements ?? []).filter((m) => m.origin === "saldo_inicial").map((m) => m.account_id)
    );
    const syntheticInitialMovements = (bankAccounts ?? [])
      .filter((account) => Number(account.initial_balance ?? 0) > 0 && !accountsWithInitialMovement.has(account.id))
      .map((account) => ({
        account_id: account.id,
        destination_account_id: null,
        type: "entrada",
        amount: Number(account.initial_balance ?? 0),
        movement_date: String(account.created_at).slice(0, 10),
        description: `Saldo inicial — ${account.name}`,
        category: "Saldo inicial",
        origin: "saldo_inicial_sintetico",
      }));
    const all = [...(bankMovements ?? []), ...syntheticInitialMovements];
    if (accountFilter === "todas") return all;
    return all.filter((m) => m.account_id === accountFilter || m.destination_account_id === accountFilter);
  }, [bankMovements, bankAccounts, accountFilter]);

  // Recebíveis/pagáveis futuros — projeção apenas se filtro = todas (ou filtrados por bank_account_id)
  const { data: futurePayables } = useQuery({
    queryKey: ["cashflow", "payables", accountFilter],
    queryFn: async () => {
      let q = supabase
        .from("payables")
        .select("amount,due_date,description,status,bank_account_id")
        .neq("status", "pago")
        .neq("status", "cancelado")
        .gte("due_date", isoDay(today))
        .lte("due_date", isoDay(endFuture));
      if (accountFilter !== "todas") q = q.eq("bank_account_id", accountFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: futureReceivables } = useQuery({
    queryKey: ["cashflow", "receivables", accountFilter],
    queryFn: async () => {
      let q = supabase
        .from("receivables" as any)
        .select("amount,received_amount,due_date,description,status,bank_account_id")
        .neq("status", "recebido")
        .neq("status", "cancelado")
        .gte("due_date", isoDay(today))
        .lte("due_date", isoDay(endFuture));
      if (accountFilter !== "todas") q = (q as any).eq("bank_account_id", accountFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const chart = useMemo(() => {
    const todayKey = isoDay(today);
    const startKey = isoDay(startPast);
    const endKey = isoDay(endFuture);

    // Saldo de abertura = todas as movimentações ANTES do período.
    // Saldos iniciais sem movimento gravado entram como movimentações sintéticas em filteredMovements.
    let opening = 0;
    for (const m of filteredMovements) {
      if (m.movement_date >= startKey) continue;
      const amt = Number(m.amount);
      if (m.type === "entrada") opening += amt;
      else if (m.type === "saida") opening -= amt;
      else if (m.type === "transferencia") {
        if (accountFilter === "todas") {
          // intra-sistema: zero
        } else {
          if (m.account_id === accountFilter) opening -= amt;
          if (m.destination_account_id === accountFilter) opening += amt;
        }
      }
    }

    const days: Record<string, { date: string; income: number; expense: number; projIncome: number; projExpense: number }> = {};
    const cursor = new Date(startPast);
    while (cursor <= endFuture) {
      const k = isoDay(cursor);
      days[k] = { date: k, income: 0, expense: 0, projIncome: 0, projExpense: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const m of filteredMovements) {
      const k = m.movement_date;
      if (!days[k]) continue;
      const amt = Number(m.amount);
      if (m.type === "entrada") days[k].income += amt;
      else if (m.type === "saida") days[k].expense += amt;
      else if (m.type === "transferencia") {
        if (accountFilter !== "todas") {
          if (m.account_id === accountFilter) days[k].expense += amt;
          if (m.destination_account_id === accountFilter) days[k].income += amt;
        }
      }
    }

    for (const p of futurePayables ?? []) {
      const k = p.due_date;
      if (!days[k] || k <= todayKey) continue;
      days[k].projExpense += Number(p.amount);
    }
    for (const r of futureReceivables ?? []) {
      const k = r.due_date;
      if (!days[k] || k <= todayKey) continue;
      days[k].projIncome += Number(r.amount) - Number(r.received_amount);
    }

    let balance = opening;
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

    const todayIdx = series.findIndex((s) => s.date === todayKey);
    if (todayIdx >= 0) (series[todayIdx] as any).saldoProjetado = series[todayIdx].saldoReal;

    return series;
  }, [filteredMovements, futurePayables, futureReceivables, accountFilter]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    const startKey = isoDay(startPast);
    const todayKey = isoDay(today);
    for (const m of filteredMovements) {
      if (m.movement_date < startKey || m.movement_date > todayKey) continue;
      const amt = Number(m.amount);
      if (m.type === "entrada") income += amt;
      else if (m.type === "saida") expense += amt;
      else if (m.type === "transferencia" && accountFilter !== "todas") {
        if (m.account_id === accountFilter) expense += amt;
        if (m.destination_account_id === accountFilter) income += amt;
      }
    }
    return { income, expense, balance: income - expense };
  }, [filteredMovements, accountFilter]);

  const displayedBalance = accountFilter === "todas" ? totalBankBalance : (bankBalances[accountFilter] ?? 0);

  // Tabela diária com saldo acumulado real (do mais antigo p/ mais recente, depois invertido p/ exibir)
  const daily = useMemo(() => {
    const todayKey = isoDay(today);
    const startKey = isoDay(startPast);

    // 1) Saldo anterior = todas as movimentações ANTES do startKey.
    // Saldos iniciais sem movimento gravado entram como movimentações sintéticas em filteredMovements.
    let opening = 0;
    for (const m of filteredMovements) {
      if (m.movement_date >= startKey) continue;
      const amt = Number(m.amount);
      if (m.type === "entrada") opening += amt;
      else if (m.type === "saida") opening -= amt;
      else if (m.type === "transferencia" && accountFilter !== "todas") {
        if (m.account_id === accountFilter) opening -= amt;
        if (m.destination_account_id === accountFilter) opening += amt;
      }
    }

    // 2) Gera todos os dias do intervalo (inclui dias sem movimento)
    const days: Record<string, { date: string; income: number; expense: number }> = {};
    const cursor = new Date(startPast);
    while (isoDay(cursor) <= todayKey) {
      const k = isoDay(cursor);
      days[k] = { date: k, income: 0, expense: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    // 3) Soma movimentações de cada dia
    for (const m of filteredMovements) {
      const k = m.movement_date;
      if (!days[k]) continue;
      const amt = Number(m.amount);
      if (m.type === "entrada") days[k].income += amt;
      else if (m.type === "saida") days[k].expense += amt;
      else if (m.type === "transferencia" && accountFilter !== "todas") {
        if (m.account_id === accountFilter) days[k].expense += amt;
        if (m.destination_account_id === accountFilter) days[k].income += amt;
      }
    }

    // 4) Acumula dia a dia (ASC)
    let saldo = opening;
    const asc = Object.values(days)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        saldo += d.income - d.expense;
        return { ...d, saldoAcumulado: saldo };
      });

    const mostRecentBalance = asc.length ? asc[asc.length - 1].saldoAcumulado : opening;
    const visibleDays = onlyMovementDays ? asc.filter((d) => d.income > 0 || d.expense > 0) : asc;
    const rows = visibleDays.slice(-15).reverse();

    return { rows, finalBalance: mostRecentBalance };
  }, [filteredMovements, accountFilter, onlyMovementDays]);

  const divergence = Math.abs(daily.finalBalance - displayedBalance) > 0.01;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Fluxo de caixa" subtitle="Visão diária com projeção dos próximos 15 dias" />

      <Tabs defaultValue="diario" className="mb-4">
        <TabsList>
          <TabsTrigger value="diario">Diário</TabsTrigger>
          <TabsTrigger value="projecao">Projeção</TabsTrigger>
        </TabsList>
        <TabsContent value="projecao" className="mt-4">
          <CashProjection />
        </TabsContent>
        <TabsContent value="diario" className="mt-4 space-y-6">

      <Card className="shadow-soft mb-4"><CardContent className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 min-w-56">
          <Label className="text-xs">Conta bancária</Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {(bankAccounts ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: a.color }} />
                    {a.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="only-movement-days" checked={onlyMovementDays} onCheckedChange={setOnlyMovementDays} />
          <Label htmlFor="only-movement-days" className="text-sm cursor-pointer">
            Mostrar só dias com movimento
          </Label>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">Saldo bancário {accountFilter === "todas" ? "consolidado" : "da conta"}</div>
          <div className={`font-display text-2xl ${displayedBalance < 0 ? "text-destructive" : ""}`}>
            {brl(displayedBalance)}
          </div>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-primary/10 text-primary items-center justify-center mb-3"><Landmark className="size-5" /></div>
          <div className="text-2xl font-display">{(bankAccounts ?? []).length}</div>
          <div className="text-xs text-muted-foreground mt-1">Contas ativas</div>
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
          <div className="px-5 py-4 border-b font-display">
            Movimentação diária ({onlyMovementDays ? "dias com movimento" : "últimos 15 dias"})
          </div>
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
              {daily.rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Sem movimentações no período.</TableCell></TableRow>
              )}
              {daily.rows.map((d) => {
                const net = d.income - d.expense;
                return (
                  <TableRow key={d.date}>
                    <TableCell>{dateBR(d.date)}</TableCell>
                    <TableCell className="text-right text-success">{brl(d.income)}</TableCell>
                    <TableCell className="text-right text-destructive">{brl(d.expense)}</TableCell>
                    <TableCell className={`text-right font-medium ${net >= 0 ? "text-success" : net < 0 ? "text-destructive" : ""}`}>{brl(net)}</TableCell>
                    <TableCell className={`text-right font-medium ${d.saldoAcumulado < 0 ? "text-destructive" : ""}`}>{brl(d.saldoAcumulado)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-5 py-4 border-t flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Saldo acumulado: </span>
              <span className={`font-display text-lg ${daily.finalBalance < 0 ? "text-destructive" : ""}`}>{brl(daily.finalBalance)}</span>
            </div>
            {divergence ? (
              <div className="text-sm text-destructive font-medium">
                ⚠️ Divergência de {brl(Math.abs(daily.finalBalance - displayedBalance))} — verificar movimentações não registradas
              </div>
            ) : (
              <div className="text-sm text-success">✓ Confere com saldo bancário {accountFilter === "todas" ? "consolidado" : "da conta"}</div>
            )}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
