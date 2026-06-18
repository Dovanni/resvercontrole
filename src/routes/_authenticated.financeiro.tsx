import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, TrendingDown, TrendingUp, Landmark, ChevronDown, ChevronUp, Scale } from "lucide-react";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Rosé" }] }),
  component: FinancePage,
});

const EXPENSE_CATS = ["estoque", "embalagem", "marketing", "frete", "operacional", "outros"];

function FinancePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedBalance, setExpandedBalance] = useState(false);

  const { data: bankAccounts } = useQuery({
    queryKey: ["finance", "bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id,name,bank,color,initial_balance,status")
        .eq("status", "ativa")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string; initial_balance: number }[];
    },
  });

  const { data: bankMovements } = useQuery({
    queryKey: ["finance", "bank-movements-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements" as any)
        .select("account_id,destination_account_id,type,amount");
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
    queryKey: ["finance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_entries").select("*").order("entry_date", { ascending: false }).limit(200);
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
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Removido");
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Financeiro"
        subtitle="Entradas e saídas do seu negócio"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Nova movimentação</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Nova movimentação</DialogTitle></DialogHeader>
              <EntryForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />
            </DialogContent>
          </Dialog>
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
    </div>
  );
}

function EntryForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("estoque");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("finance_entries").insert({
        user_id: user.id, type, category, amount, description: description || null,
      } as any);
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
