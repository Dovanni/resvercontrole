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
import { ArrowDownRight, ArrowUpRight, Wallet, Landmark, HelpCircle } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CashProjection } from "@/components/cash-projection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/fluxo-caixa")({
  head: () => ({ meta: [{ title: "Fluxo de caixa — Rosé" }] }),
  component: CashFlowPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Card className="shadow-soft border-destructive/40">
        <CardContent className="p-6 space-y-3">
          <div className="font-display text-lg text-destructive">Erro ao carregar Fluxo de caixa</div>
          <div className="text-sm text-muted-foreground">{error?.message ?? "Falha desconhecida"}</div>
          <button onClick={() => reset()} className="text-sm underline">Tentar novamente</button>
        </CardContent>
      </Card>
    </div>
  ),
});

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

type CashMovement = {
  account_id: string | null;
  destination_account_id: string | null;
  type: string;
  amount: number;
  movement_date: string;
  description: string | null;
  category: string | null;
  origin: string | null;
  reference_id: string | null;
};

type PayableCashSource = { id: string; description: string | null; category: string | null; amount: number; paid_amount: number | null; due_date: string; paid_at: string | null; status: string; bank_account_id: string | null };
type ReceivableCashSource = { id: string; sale_id: string | null; description: string | null; amount: number; received_amount: number | null; due_date: string; received_at: string | null; status: string; bank_account_id: string | null };
type SaleCashSource = { id: string; customer_name: string | null; payment_method: string | null; total: number; sold_at: string; status: string; bank_account_id: string | null };
type PurchaseCashSource = { id: string; total: number; data_compra: string; status: string | null; condicao_pagamento: string | null; forma_pagamento: string | null; bank_account_id: string | null };

function CashFlowPage() {
  const today = new Date();
  const startPast = new Date(today); startPast.setDate(today.getDate() - 30);
  const endFuture = new Date(today); endFuture.setDate(today.getDate() + 15);
  const [accountFilter, setAccountFilter] = useState<string>("todas");
  const [onlyMovementDays, setOnlyMovementDays] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

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
        .select("account_id,destination_account_id,type,amount,movement_date,description,category,origin,reference_id");
      if (error) throw error;
      return (data ?? []) as unknown as CashMovement[];
    },
  });

  const { data: paidPayables } = useQuery({
    queryKey: ["cashflow", "paid-payables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("id,description,category,amount,paid_amount,due_date,paid_at,status,bank_account_id")
        .eq("status", "pago");
      if (error) throw error;
      return (data ?? []) as unknown as PayableCashSource[];
    },
  });

  const { data: receivableSources } = useQuery({
    queryKey: ["cashflow", "receivable-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables" as any)
        .select("id,sale_id,description,amount,received_amount,due_date,received_at,status,bank_account_id");
      if (error) throw error;
      return (data ?? []) as unknown as ReceivableCashSource[];
    },
  });

  const { data: deliveredSales } = useQuery({
    queryKey: ["cashflow", "delivered-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,customer_name,payment_method,total,sold_at,status,bank_account_id")
        .eq("status", "entregue");
      if (error) throw error;
      return (data ?? []) as unknown as SaleCashSource[];
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["cashflow", "purchase-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras" as any)
        .select("id,total,data_compra,status,condicao_pagamento,forma_pagamento,bank_account_id");
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseCashSource[];
    },
  });

  const cashMovements = useMemo(() => {
    try {
      const posted = bankMovements ?? [];
      const postedByReference = new Set(
        posted.filter((m) => m.origin && m.reference_id).map((m) => `${m.origin}:${m.reference_id}`),
      );
      const hasSamePostedMovement = (type: string, accountId: string | null, date: string, amount: number) =>
        posted.some((m) =>
          m.type === type
          && (m.account_id ?? null) === (accountId ?? null)
          && m.movement_date === date
          && Math.abs(Number(m.amount) - amount) < 0.01,
        );

      const safeDate = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);
      const missing: CashMovement[] = [];

      for (const p of paidPayables ?? []) {
        const amount = Number(p.paid_amount || p.amount || 0);
        const movementDate = safeDate(p.paid_at) ?? safeDate(p.due_date);
        if (!movementDate || amount <= 0 || postedByReference.has(`payable:${p.id}`) || hasSamePostedMovement("saida", p.bank_account_id, movementDate, amount)) continue;
        missing.push({
          account_id: p.bank_account_id,
          destination_account_id: null,
          type: "saida",
          amount,
          movement_date: movementDate,
          description: p.description,
          category: p.category,
          origin: "payable_fallback",
          reference_id: p.id,
        });
      }

      for (const r of receivableSources ?? []) {
        const amount = Number(r.received_amount || (r.status === "recebido" ? r.amount : 0) || 0);
        const movementDate = safeDate(r.received_at) ?? safeDate(r.due_date);
        if (!movementDate || amount <= 0 || postedByReference.has(`receivable:${r.id}`) || hasSamePostedMovement("entrada", r.bank_account_id, movementDate, amount)) continue;
        missing.push({
          account_id: r.bank_account_id,
          destination_account_id: null,
          type: "entrada",
          amount,
          movement_date: movementDate,
          description: r.description,
          category: "Recebimento de venda",
          origin: "receivable_fallback",
          reference_id: r.id,
        });
      }

      const salesWithReceivable = new Set((receivableSources ?? []).filter((r) => r.sale_id).map((r) => r.sale_id));
      for (const s of deliveredSales ?? []) {
        const amount = Number(s.total ?? 0);
        const movementDate = safeDate(s.sold_at);
        if (!movementDate || amount <= 0 || salesWithReceivable.has(s.id) || postedByReference.has(`sale:${s.id}`) || hasSamePostedMovement("entrada", s.bank_account_id, movementDate, amount)) continue;
        missing.push({
          account_id: s.bank_account_id,
          destination_account_id: null,
          type: "entrada",
          amount,
          movement_date: movementDate,
          description: `Venda — ${s.customer_name ?? "balcão"}`,
          category: "Recebimento de venda",
          origin: "sale_fallback",
          reference_id: s.id,
        });
      }

      const purchasesWithPaidPayable = new Set(
        (paidPayables ?? [])
          .map((p) => p.description?.match(/Compra #([a-f0-9]{8})/i)?.[1])
          .filter(Boolean),
      );
      for (const c of purchases ?? []) {
        const amount = Number(c.total ?? 0);
        const movementDate = safeDate(c.data_compra);
        const canceled = ["cancelada", "cancelado"].includes(String(c.status ?? "").toLowerCase());
        if (!movementDate || amount <= 0 || c.condicao_pagamento !== "a_vista" || canceled || purchasesWithPaidPayable.has(c.id.slice(0, 8)) || postedByReference.has(`compra:${c.id}`) || hasSamePostedMovement("saida", c.bank_account_id, movementDate, amount)) continue;
        missing.push({
          account_id: c.bank_account_id,
          destination_account_id: null,
          type: "saida",
          amount,
          movement_date: movementDate,
          description: `Compra #${c.id.slice(0, 8)}`,
          category: "Fornecedor",
          origin: "purchase_fallback",
          reference_id: c.id,
        });
      }

      return [...posted, ...missing];
    } catch (err) {
      console.error("[fluxo-caixa] cashMovements failed", err);
      return (bankMovements ?? []) as CashMovement[];
    }
  }, [bankMovements, paidPayables, receivableSources, deliveredSales, purchases]);

  // Saldo consolidado (todas as movimentações)
  const bankBalances = useMemo(() => {
    const accountsWithInitialMovement = new Set(
      (bankMovements ?? []).filter((m) => m.origin === "saldo_inicial").map((m) => m.account_id)
    );
    const map: Record<string, number> = {};
    for (const a of bankAccounts ?? []) map[a.id] = accountsWithInitialMovement.has(a.id) ? 0 : Number(a.initial_balance ?? 0);
    for (const m of bankMovements ?? []) {
      if (!m.account_id) continue;
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
      cashMovements.filter((m) => m.origin === "saldo_inicial").map((m) => m.account_id)
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
        reference_id: account.id,
      }));
    const all = [...cashMovements, ...syntheticInitialMovements];
    if (accountFilter === "todas") return all;
    return all.filter((m) => m.account_id === accountFilter || m.destination_account_id === accountFilter);
  }, [cashMovements, bankAccounts, accountFilter]);

  // Recebíveis/pagáveis futuros — projeção apenas se filtro = todas (ou filtrados por bank_account_id)
  const { data: futurePayables } = useQuery({
    queryKey: ["cashflow", "payables", accountFilter],
    queryFn: async () => {
      let q = supabase
        .from("payables")
        .select("amount,due_date,description,status,bank_account_id")
        .not("status", "in", "(pago,cancelado)")
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
        .not("status", "in", "(recebido,cancelado)")
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
    const rows = visibleDays.slice(-15);

    return { rows, finalBalance: mostRecentBalance };
  }, [filteredMovements, accountFilter, onlyMovementDays]);

  // Saldo acumulado usando SOMENTE bank_movements reais (+ saldos iniciais sintéticos),
  // sem os fallbacks de payables/receivables/sales/compras. Fonte homogênea à do
  // saldo bancário consolidado — evita alerta indevido por artefato de fallback.
  const realFinalBalance = useMemo(() => {
    const todayKey = isoDay(today);
    const accountsWithInitialMovement = new Set(
      (bankMovements ?? []).filter((m) => m.origin === "saldo_inicial").map((m) => m.account_id),
    );
    const syntheticInitial = (bankAccounts ?? [])
      .filter((a) => Number(a.initial_balance ?? 0) > 0 && !accountsWithInitialMovement.has(a.id))
      .map((a) => ({
        account_id: a.id,
        destination_account_id: null as string | null,
        type: "entrada",
        amount: Number(a.initial_balance ?? 0),
        movement_date: String(a.created_at).slice(0, 10),
      }));
    const all = [
      ...((bankMovements ?? []).map((m) => ({
        account_id: m.account_id,
        destination_account_id: m.destination_account_id,
        type: m.type,
        amount: Number(m.amount),
        movement_date: m.movement_date,
      }))),
      ...syntheticInitial,
    ];
    const scoped = accountFilter === "todas"
      ? all
      : all.filter((m) => m.account_id === accountFilter || m.destination_account_id === accountFilter);
    let saldo = 0;
    for (const m of scoped) {
      if (m.movement_date > todayKey) continue;
      const amt = Number(m.amount);
      if (m.type === "entrada") saldo += amt;
      else if (m.type === "saida") saldo -= amt;
      else if (m.type === "transferencia" && accountFilter !== "todas") {
        if (m.account_id === accountFilter) saldo -= amt;
        if (m.destination_account_id === accountFilter) saldo += amt;
      }
    }
    return saldo;
  }, [bankMovements, bankAccounts, accountFilter]);

  const divergence = Math.abs(realFinalBalance - displayedBalance) > 0.01;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Fluxo de caixa"
        subtitle="Visão diária com projeção dos próximos 15 dias"
        action={
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)} className="gap-2">
            <HelpCircle className="size-4" />
            Como funciona esta etapa
          </Button>
        }
      />

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💰 Fluxo de Caixa — Controle e Projeção Financeira</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-semibold text-base mb-1">🎯 Objetivo desta etapa</h3>
              <p className="text-muted-foreground">
                O módulo Fluxo de Caixa acompanha diariamente toda a movimentação financeira da empresa,
                apresentando entradas, saídas, saldo disponível e projeções futuras. Oferece ao gestor uma
                visão clara da situação financeira atual e futura, permitindo um planejamento seguro das operações.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-1">📌 O que pode ser feito</h3>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Visualizar entradas e saídas financeiras</li>
                <li>Acompanhar o saldo disponível e consolidado</li>
                <li>Visualizar projeções futuras do caixa</li>
                <li>Comparar saldo real e projetado</li>
                <li>Selecionar contas bancárias específicas</li>
                <li>Visualizar somente dias com movimentação</li>
                <li>Alternar entre visão diária e projeção</li>
                <li>Monitorar indicadores financeiros</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-1">🔄 Fluxo recomendado</h3>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li><strong>Selecionar a conta bancária</strong> — escolha uma conta específica ou "Todas as contas".</li>
                <li><strong>Escolher o modo de visualização</strong> — aba <em>Diário</em> (movimentação realizada) ou <em>Projeção</em> (previsão dos próximos dias).</li>
                <li><strong>Utilizar o filtro</strong> — ative "Mostrar somente dias com movimento" para uma análise mais objetiva.</li>
                <li><strong>Acompanhar os indicadores</strong> — entradas, saídas, saldo do período, contas ativas e saldo consolidado.</li>
                <li><strong>Analisar o gráfico</strong> — evolução do saldo real, projeção futura e tendência financeira.</li>
              </ol>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-1">🎯 Objetivo do resultado</h3>
              <p className="text-muted-foreground mb-1">
                Visão completa do comportamento financeiro para controlar entradas/saídas, prever necessidades de caixa,
                identificar períodos críticos, planejar pagamentos e recebimentos e apoiar decisões financeiras.
              </p>
              <p className="text-muted-foreground">
                As informações alimentam: Financeiro, Contas a Pagar, Contas a Receber, BI, Dashboard Financeiro,
                Indicadores Gerenciais e Planejamento Financeiro.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Registrar corretamente todas as movimentações</li>
                <li>Manter contas bancárias atualizadas</li>
                <li>Conferir lançamentos diariamente</li>
                <li>Acompanhar projeções futuras</li>
                <li>Revisar frequentemente o saldo consolidado</li>
                <li>Usar o fluxo de caixa como principal ferramenta de planejamento</li>
              </ul>
            </section>

            <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <h3 className="font-semibold text-base mb-1">⚠️ Importante</h3>
              <p className="text-muted-foreground">
                A precisão das informações depende da atualização correta dos módulos Vendas, Compras,
                Contas a Pagar, Contas a Receber e Contas Bancárias. Quanto mais atualizados, maior a
                confiabilidade das projeções.
              </p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
                ⚠️ Divergência de {brl(Math.abs(realFinalBalance - displayedBalance))} — verificar movimentações não registradas
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
