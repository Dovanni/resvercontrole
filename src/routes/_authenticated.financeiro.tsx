import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, TrendingDown, TrendingUp, Landmark, ChevronDown, ChevronUp, Scale, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Vejamais" }] }),
  component: FinancePage,
});

const EXPENSE_CATS = ["estoque", "embalagem", "marketing", "frete", "operacional", "outros"];

function FinancePage() {
  const qc = useQueryClient();
  const { empresaId, isEnabled } = useMultiempresa();
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [expandedBalance, setExpandedBalance] = useState(false);

  const { data: bankAccounts } = useQuery({
    queryKey: ["finance", "bank-accounts", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("bank_accounts")
        .select("id,name,bank,color,initial_balance,status")
        .eq("status", "ativa");
      
      if (isEnabled && empresaId) query = query.eq("empresa_id", empresaId);

      const { data, error } = await query.order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string; initial_balance: number }[];
    },
  });

  const { data: bankMovements } = useQuery({
    queryKey: ["finance", "bank-movements-all", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("bank_movements")
        .select("account_id,destination_account_id,type,amount");
      
      if (isEnabled && empresaId) query = query.eq("empresa_id", empresaId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as { account_id: string; destination_account_id: string | null; type: string; amount: number }[];
    },
  });

  const bankBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of bankAccounts ?? []) map[a.id] = 0; // saldo inicial já entra como movimento 'saldo_inicial'
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


  const { data } = useQuery({
    queryKey: ["finance", empresaId],
    queryFn: async () => {
      let q = supabase.from("finance_entries").select("*");
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("entry_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const income = (data ?? []).filter((d: any) => d.type === "income").reduce((s, d: any) => s + Number(d.amount), 0);
    const expense = (data ?? []).filter((d: any) => d.type === "expense").reduce((s, d: any) => s + Number(d.amount), 0);
    return { income, expense, balance: income - expense };
  }, [data]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", empresaId] });
      qc.invalidateQueries({ queryKey: ["dashboard", empresaId] });
      toast.success("Removido");
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Financeiro"
        subtitle="Entradas e saídas do seu negócio"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)}>
              <HelpCircle className="size-4 mr-1" /> Como funciona
            </Button>
            <Link to="/balancete"><Button variant="outline"><Scale className="size-4 mr-1" /> Balancete</Button></Link>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Nova movimentação</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Nova movimentação</DialogTitle></DialogHeader>
                <EntryForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["finance", empresaId] }); qc.invalidateQueries({ queryKey: ["dashboard", empresaId] }); }} empresaId={isEnabled ? (empresaId ?? undefined) : undefined} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card className="shadow-soft mb-4 cursor-pointer hover:shadow-md transition" onClick={() => setExpandedBalance((v) => !v)}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-10 rounded-xl bg-primary/10 text-primary items-center justify-center"><Landmark className="size-5" /></div>
              <div>
                <div className="text-xs text-muted-foreground">Saldo em conta (consolidado)</div>
                <div className={`text-2xl font-display ${totalBankBalance < 0 ? "text-destructive" : ""}`}>{brl(totalBankBalance)}</div>
              </div>
            </div>
            {expandedBalance ? <ChevronUp className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
          </div>
          {expandedBalance && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t pt-4">
              {(bankAccounts ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma conta bancária ativa.</div>
              )}
              {(bankAccounts ?? []).map((a) => {
                const b = bankBalances[a.id] ?? 0;
                return (
                  <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: a.color }} />
                      {a.name}
                      <span className="text-xs text-muted-foreground">({a.bank})</span>
                    </span>
                    <span className={`font-medium text-sm ${b < 0 ? "text-destructive" : ""}`}>{brl(b)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4 mb-6">

        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-success/10 text-success items-center justify-center mb-3"><TrendingUp className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.income)}</div>
          <div className="text-xs text-muted-foreground mt-1">Entradas</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-destructive/10 text-destructive items-center justify-center mb-3"><TrendingDown className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.expense)}</div>
          <div className="text-xs text-muted-foreground mt-1">Saídas</div>
        </CardContent></Card>
        <Card className="shadow-soft bg-gradient-rose"><CardContent className="p-5">
          <div className="text-2xl font-display">{brl(totals.balance)}</div>
          <div className="text-xs text-muted-foreground mt-1">Saldo</div>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Sem movimentações.</TableCell></TableRow>
              )}
              {data?.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{dateBR(e.entry_date)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${e.type === "income" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {e.type === "income" ? "Entrada" : "Saída"}
                    </span>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{e.category}</TableCell>
                  <TableCell>{e.description ?? "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${e.type === "income" ? "text-success" : "text-destructive"}`}>
                    {e.type === "income" ? "+" : "−"} {brl(Number(e.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    {!e.sale_id && (
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) remove.mutate(e.id); }}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <HelpDialog open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}

function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Como funciona o Financeiro</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold text-base mb-2">📌 Objetivo desta tela</h3>
            <p className="text-muted-foreground">
              O Financeiro exibe todas as movimentações reais de dinheiro do seu negócio — entradas e saídas — mostrando em tempo real quanto você tem disponível em caixa.
            </p>
            <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
              <strong>⚠️ IMPORTANTE:</strong> Esta tela reflete apenas movimentações <strong>JÁ REALIZADAS</strong> (dinheiro que já entrou ou saiu das suas contas bancárias). Valores previstos ficam em <em>Contas a Pagar</em> e <em>Contas a Receber</em>.
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">💰 Cards do topo</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <strong className="text-foreground">🏦 Saldo em conta (consolidado)</strong><br />
                Soma dos saldos atuais de TODAS as suas contas bancárias ativas (Bradesco, Mercado Pago, Nubank, Caixa-Resvera, etc.).<br />
                → É o dinheiro <strong>REAL disponível agora</strong>.
              </div>
              <div className="rounded-lg bg-success/5 border border-success/20 p-3">
                <strong className="text-foreground">🟢 Entradas</strong><br />
                Total de dinheiro que entrou nas suas contas no período filtrado (vendas recebidas, aportes, etc.).
              </div>
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                <strong className="text-foreground">🔴 Saídas</strong><br />
                Total de dinheiro que saiu das suas contas no período filtrado (pagamentos, despesas, etc.).
              </div>
              <div className="rounded-lg bg-muted/40 border p-3">
                <strong className="text-foreground">⚖️ Saldo do período</strong><br />
                <code className="text-xs">Entradas − Saídas</code> do período.
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">📋 Tabela de movimentações</h3>
            <p className="text-muted-foreground mb-2">
              Lista todas as movimentações financeiras em ordem cronológica:
            </p>
            <ul className="text-muted-foreground text-xs space-y-1 mb-3 pl-4 list-disc">
              <li><strong>Data:</strong> quando o dinheiro movimentou</li>
              <li><strong>Tipo:</strong> Entrada (🟢) ou Saída (🔴)</li>
              <li><strong>Categoria:</strong> origem (venda, fornecedor, cartão, etc.)</li>
              <li><strong>Descrição:</strong> detalhe do lançamento</li>
              <li><strong>Valor:</strong> montante da movimentação</li>
            </ul>
            <div className="rounded-lg bg-muted/40 border p-3 text-xs space-y-2">
              <div>
                <strong>Tipos automáticos [AUTO]</strong> — gerados pelo sistema:
                <ul className="pl-4 list-disc mt-1 space-y-0.5">
                  <li>✅ Venda com status <em>Entregue</em> → Entrada automática</li>
                  <li>✅ Conta a Pagar marcada como <em>Pago</em> → Saída automática</li>
                  <li>✅ Conta a Receber marcada como <em>Recebido</em> → Entrada automática</li>
                </ul>
              </div>
              <div>
                <strong>Lançamentos manuais:</strong> criados diretamente em <em>Contas Bancárias → Nova movimentação</em>.
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">🏦 Contas bancárias vinculadas</h3>
            <p className="text-muted-foreground mb-2">
              Cada movimentação está vinculada a uma conta bancária específica. O saldo consolidado soma todas as contas ativas:
            </p>
            <ul className="text-muted-foreground text-xs pl-4 list-disc space-y-1">
              <li><strong>Mercado Pago:</strong> recebe vendas com cartão de crédito e débito</li>
              <li><strong>Outras contas</strong> (Bradesco, Nubank, Caixa): recebem PIX, depósito, dinheiro, transferências</li>
            </ul>
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
              <strong>⚠️ Atenção — Cartões de Crédito:</strong> Os lançamentos de cartão de crédito que aparecem aqui são <strong>saídas</strong> das contas bancárias vinculadas quando a fatura é paga em <em>Contas a Pagar</em>. O módulo <em>Cartões de Crédito</em> é apenas para acompanhamento de limite e gastos — não gera movimentação bancária direta.
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">🔍 Como filtrar</h3>
            <p className="text-muted-foreground mb-2">Use os filtros para analisar períodos específicos:</p>
            <ul className="text-muted-foreground text-xs pl-4 list-disc space-y-1">
              <li>Hoje, Esta semana, Este mês, Mês anterior ou Personalizado</li>
              <li>Filtrar por conta bancária específica ou ver todas juntas</li>
              <li>Filtrar por tipo (Entrada/Saída)</li>
              <li>Filtrar por categoria</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">⚙️ Fluxo completo do dinheiro</h3>
            <div className="rounded-lg bg-gradient-rose/30 border p-3 text-xs font-mono leading-6">
              VENDA realizada<br />
              &nbsp;&nbsp;↓ status = "Entregue"<br />
              &nbsp;&nbsp;↓ gera <strong>Entrada</strong> automática<br />
              &nbsp;&nbsp;↓<br />
              COMPRA / DESPESA lançada<br />
              &nbsp;&nbsp;↓ marcada como "Pago"<br />
              &nbsp;&nbsp;↓ gera <strong>Saída</strong> automática<br />
              &nbsp;&nbsp;↓<br />
              SALDO EM CONTA atualizado em tempo real
            </div>
          </section>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)} className="bg-gradient-primary text-primary-foreground">
            Entendi ✓
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({ onDone, empresaId }: { onDone: () => void; empresaId?: string }) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("estoque");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("finance_entries").insert({
        user_id: user.id,
        empresa_id: empresaId!,
        type, category, amount, description: description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salvo"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const cats = type === "income" ? ["venda", "outros"] : EXPENSE_CATS;

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v: any) => { setType(v); setCategory(v === "income" ? "outros" : "estoque"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Entrada</SelectItem>
              <SelectItem value="expense">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {cats.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" required min={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
