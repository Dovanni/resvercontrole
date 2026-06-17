import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Landmark, Pencil, Trash2, Download, AlertTriangle, ArrowLeftRight, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/contas-bancarias")({
  head: () => ({ meta: [{ title: "Contas bancárias — Rosé" }] }),
  component: BankAccountsPage,
});

const BANKS = ["Bradesco", "Itaú", "Banco do Brasil", "Caixa", "Nubank", "Inter", "Sicoob", "Santander", "Mercado Pago", "Outro"];
const COLORS = ["#ec4899", "#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#6366f1", "#d946ef", "#00B1EA"];
const ACCOUNT_TYPES = [
  { v: "corrente", l: "Conta Corrente" },
  { v: "poupanca", l: "Conta Poupança" },
  { v: "digital", l: "Conta Digital" },
];
const ENTRADA_CATS = ["Venda Loja Própria", "Recebimento ML", "PIX Recebido", "TED/DOC Recebido", "Transferência entre contas", "Recebimento de venda", "Outros"];
const SAIDA_CATS = ["Fornecedor", "Frete/Correios", "Taxa ML", "Google Ads", "Aluguel", "Impostos/DAS", "Salários", "Energia/Água", "Internet/Telefone", "Material de escritório", "Transferência entre contas", "Outros"];

type BankAccount = {
  id: string; name: string; bank: string; account_type: string;
  agency: string | null; account_number: string | null;
  initial_balance: number; color: string; status: "ativa" | "inativa";
};
type Movement = {
  id: string; account_id: string; movement_date: string;
  type: "entrada" | "saida" | "transferencia"; category: string;
  description: string; amount: number; destination_account_id: string | null;
  origin: string; notes: string | null;
};

function BankAccountsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [extractFor, setExtractFor] = useState<BankAccount | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts" as any).select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as BankAccount[];
    },
  });

  const { data: allMovements } = useQuery({
    queryKey: ["bank-movements", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_movements" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

  const balanceByAccount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts ?? []) map[a.id] = Number(a.initial_balance);
    for (const m of allMovements ?? []) {
      const amt = Number(m.amount);
      if (m.type === "entrada") map[m.account_id] = (map[m.account_id] ?? 0) + amt;
      else if (m.type === "saida") map[m.account_id] = (map[m.account_id] ?? 0) - amt;
      else if (m.type === "transferencia") {
        map[m.account_id] = (map[m.account_id] ?? 0) - amt;
        if (m.destination_account_id) map[m.destination_account_id] = (map[m.destination_account_id] ?? 0) + amt;
      }
    }
    return map;
  }, [accounts, allMovements]);

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-accounts"] }); toast.success("Conta removida"); },
    onError: (e: any) => toast.error(e.message),
  });

  const active = (accounts ?? []).filter((a) => a.status === "ativa");
  const inactive = (accounts ?? []).filter((a) => a.status === "inativa");

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Contas bancárias"
        subtitle="Gerencie suas contas e movimentações financeiras"
        action={
          <Button className="bg-gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="size-4 mr-1" /> Nova conta
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {active.length === 0 && (
          <Card className="shadow-soft col-span-full"><CardContent className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma conta bancária cadastrada. Clique em <strong>Nova conta</strong> para começar.
          </CardContent></Card>
        )}
        {active.map((a) => {
          const bal = balanceByAccount[a.id] ?? 0;
          const negative = bal < 0;
          return (
            <Card key={a.id} className="shadow-soft cursor-pointer transition-shadow hover:shadow-md overflow-hidden" onClick={() => setExtractFor(a)}>
              <div className="h-2" style={{ background: a.color }} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: `${a.color}22`, color: a.color }}>
                      <Landmark className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium leading-tight">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.bank} • {ACCOUNT_TYPES.find(t => t.v === a.account_type)?.l}</div>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpenForm(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (await confirm({ title: "Excluir conta?", description: `Todas as movimentações de "${a.name}" serão removidas.` })) removeAccount.mutate(a.id);
                    }}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className={`text-2xl font-display ${negative ? "text-destructive" : ""}`}>{brl(bal)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    Saldo atual {negative && <><AlertTriangle className="size-3 text-destructive" /> <span className="text-destructive">negativo</span></>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {inactive.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Inativas</div>
          <div className="flex flex-wrap gap-2">
            {inactive.map((a) => (
              <Button key={a.id} variant="outline" size="sm" onClick={() => { setEditing(a); setOpenForm(true); }}>
                <span className="size-2 rounded-full mr-2" style={{ background: a.color }} /> {a.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar conta" : "Nova conta bancária"}</DialogTitle></DialogHeader>
          <AccountForm
            initial={editing}
            onDone={() => { setOpenForm(false); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!extractFor} onOpenChange={(o) => !o && setExtractFor(null)}>
        <DialogContent className="max-w-5xl">
          {extractFor && (
            <ExtractView
              account={extractFor}
              accounts={accounts ?? []}
              balance={balanceByAccount[extractFor.id] ?? 0}
              onClose={() => setExtractFor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountForm({ initial, onDone }: { initial: BankAccount | null; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    bank: initial?.bank ?? "Nubank",
    account_type: initial?.account_type ?? "corrente",
    agency: initial?.agency ?? "",
    account_number: initial?.account_number ?? "",
    initial_balance: initial?.initial_balance ?? 0,
    color: initial?.color ?? COLORS[0],
    status: initial?.status ?? "ativa",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (initial) {
        const { error } = await supabase.from("bank_accounts" as any).update(f as any).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts" as any).insert({ ...f, user_id: user.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(initial ? "Atualizado" : "Conta criada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nome da conta</Label>
          <Input required placeholder="Ex: Bradesco PJ" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Banco</Label>
          <Select value={f.bank} onValueChange={(v) => setF({ ...f, bank: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={f.account_type} onValueChange={(v) => setF({ ...f, account_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Agência</Label>
          <Input value={f.agency} onChange={(e) => setF({ ...f, agency: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Conta</Label>
          <Input value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Saldo inicial (R$)</Label>
          <Input type="number" step="0.01" value={f.initial_balance} onChange={(e) => setF({ ...f, initial_balance: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v: any) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="inativa">Inativa</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Cor de identificação</Label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, color: c })}
                className={`size-8 rounded-full border-2 transition ${f.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

function ExtractView({ account, accounts, balance, onClose }: { account: BankAccount; accounts: BankAccount[]; balance: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [catFilter, setCatFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [openNew, setOpenNew] = useState(false);

  const { data: movements } = useQuery({
    queryKey: ["bank-movements", account.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements" as any)
        .select("*")
        .or(`account_id.eq.${account.id},destination_account_id.eq.${account.id}`)
        .order("movement_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

  const filtered = useMemo(() => {
    return (movements ?? []).filter((m) => {
      if (from && m.movement_date < from) return false;
      if (to && m.movement_date > to) return false;
      if (catFilter !== "todos" && m.category !== catFilter) return false;
      if (typeFilter !== "todos") {
        // for a transfer-in to this account, treat as entrada
        const isIncoming = m.type === "transferencia" && m.destination_account_id === account.id;
        const effType = isIncoming ? "entrada" : m.type === "transferencia" ? "saida" : m.type;
        if (typeFilter === "transferencia" && m.type !== "transferencia") return false;
        if (typeFilter !== "transferencia" && effType !== typeFilter) return false;
      }
      return true;
    });
  }, [movements, from, to, catFilter, typeFilter, account.id]);

  // Compute running balance
  let running = Number(account.initial_balance);
  const rows = filtered.map((m) => {
    let delta = 0;
    const isIncoming = m.type === "transferencia" && m.destination_account_id === account.id;
    if (m.type === "entrada" || isIncoming) delta = Number(m.amount);
    else delta = -Number(m.amount);
    running += delta;
    return { ...m, delta, runningBalance: running };
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_movements" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-movements"] });
      toast.success("Movimentação removida");
    },
  });

  const exportXlsx = () => {
    const data = rows.map((r) => ({
      Data: dateBR(r.movement_date),
      Tipo: r.type === "transferencia" && r.destination_account_id === account.id ? "Transf. entrada" : r.type,
      Categoria: r.category,
      Descrição: r.description,
      Valor: r.delta,
      Saldo: r.runningBalance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extrato");
    XLSX.writeFile(wb, `extrato_${account.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <DialogHeader className="mb-4">
        <DialogTitle className="font-display flex items-center gap-3">
          <span className="size-8 rounded-lg flex items-center justify-center" style={{ background: `${account.color}22`, color: account.color }}>
            <Landmark className="size-4" />
          </span>
          Extrato — {account.name}
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Saldo inicial</div>
          <div className="font-display text-lg">{brl(Number(account.initial_balance))}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Movimentações</div>
          <div className="font-display text-lg">{rows.length}</div>
        </CardContent></Card>
        <Card className={balance < 0 ? "border-destructive" : ""}><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Saldo atual</div>
          <div className={`font-display text-lg ${balance < 0 ? "text-destructive" : ""}`}>{brl(balance)}</div>
        </CardContent></Card>
      </div>

      {account.bank === "Mercado Pago" && (() => {
        const vendas = rows.filter(r => r.delta > 0).reduce((s, r) => s + r.delta, 0);
        const taxas = rows.filter(r => r.delta < 0 && /taxa|juros|ml/i.test(r.category + " " + r.description)).reduce((s, r) => s + Math.abs(r.delta), 0);
        return (
          <Card className="mb-4 border-[#00B1EA]/40"><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <div>
              <div className="text-xs text-muted-foreground">Vendas recebidas</div>
              <div className="font-display text-lg text-success">{brl(vendas)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Taxas / juros ML</div>
              <div className="font-display text-lg text-destructive">{brl(taxas)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Disponível p/ saque</div>
              <div className="font-display text-lg" style={{ color: "#00B1EA" }}>{brl(balance)}</div>
            </div>
            <Button onClick={() => setOpenNew(true)} className="bg-[#00B1EA] hover:bg-[#0096c7] text-white">
              <ArrowLeftRight className="size-4 mr-1" /> Registrar saque
            </Button>
          </CardContent></Card>
        );
      })()}

      <Card className="mb-3"><CardContent className="p-3 grid md:grid-cols-5 gap-2">
        <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
              <SelectItem value="transferencia">Transferências</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Categoria</Label>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {[...new Set([...ENTRADA_CATS, ...SAIDA_CATS])].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" className="flex-1" onClick={exportXlsx}><Download className="size-4 mr-1" /> Excel</Button>
        </div>
      </CardContent></Card>

      <div className="flex justify-end mb-3">
        <Button className="bg-gradient-primary text-primary-foreground" onClick={() => setOpenNew(true)}>
          <Plus className="size-4 mr-1" /> Nova movimentação
        </Button>
      </div>

      <Card><CardContent className="p-0 max-h-[50vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Sem movimentações no período.</TableCell></TableRow>
            )}
            {rows.map((m) => {
              const isIncoming = m.type === "transferencia" && m.destination_account_id === account.id;
              const isTransfer = m.type === "transferencia";
              const icon = isTransfer ? <ArrowLeftRight className="size-3.5" /> : (m.delta > 0 ? <ArrowDownCircle className="size-3.5" /> : <ArrowUpCircle className="size-3.5" />);
              const color = isTransfer ? "text-blue-600" : (m.delta > 0 ? "text-success" : "text-destructive");
              return (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{dateBR(m.movement_date)}</TableCell>
                  <TableCell>
                    {m.description}
                    {m.origin !== "manual" && <span className="ml-2 text-[10px] uppercase text-muted-foreground">[auto]</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.category}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${color} bg-current/10`}>
                      {icon} {isTransfer ? (isIncoming ? "Transf. entrada" : "Transf. saída") : (m.type === "entrada" ? "Entrada" : "Saída")}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${color}`}>
                    {m.delta > 0 ? "+" : ""}{brl(m.delta)}
                  </TableCell>
                  <TableCell className={`text-right ${m.runningBalance < 0 ? "text-destructive font-medium" : ""}`}>{brl(m.runningBalance)}</TableCell>
                  <TableCell>
                    {m.origin === "manual" && (
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) remove.mutate(m.id); }}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nova movimentação</DialogTitle></DialogHeader>
          <MovementForm
            accountId={account.id}
            accounts={accounts}
            onDone={() => {
              setOpenNew(false);
              qc.invalidateQueries({ queryKey: ["bank-movements"] });
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="mt-4 flex justify-end"><Button variant="outline" onClick={onClose}>Fechar</Button></div>
    </div>
  );
}

function MovementForm({ accountId, accounts, onDone }: { accountId: string; accounts: BankAccount[]; onDone: () => void }) {
  const [f, setF] = useState({
    movement_date: new Date().toISOString().slice(0, 10),
    type: "saida" as "entrada" | "saida" | "transferencia",
    category: SAIDA_CATS[0],
    description: "",
    amount: 0,
    destination_account_id: "",
    notes: "",
  });

  const cats = f.type === "entrada" ? ENTRADA_CATS : f.type === "transferencia" ? ["Transferência entre contas"] : SAIDA_CATS;

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (f.type === "transferencia" && !f.destination_account_id) throw new Error("Selecione a conta destino");
      const { error } = await supabase.from("bank_movements" as any).insert({
        user_id: user.id,
        account_id: accountId,
        movement_date: f.movement_date,
        type: f.type,
        category: f.type === "transferencia" ? "Transferência entre contas" : f.category,
        description: f.description || (f.type === "transferencia" ? "Transferência entre contas" : f.category),
        amount: f.amount,
        destination_account_id: f.type === "transferencia" ? f.destination_account_id : null,
        origin: f.type === "transferencia" ? "transfer" : "manual",
        notes: f.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Movimentação registrada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const otherAccounts = accounts.filter((a) => a.id !== accountId && a.status === "ativa");

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" required value={f.movement_date} onChange={(e) => setF({ ...f, movement_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={f.type} onValueChange={(v: any) => setF({ ...f, type: v, category: v === "entrada" ? ENTRADA_CATS[0] : v === "saida" ? SAIDA_CATS[0] : "Transferência entre contas" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {f.type !== "transferencia" && (
          <div className="col-span-2 space-y-1.5">
            <Label>Categoria</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {f.type === "transferencia" && (
          <div className="col-span-2 space-y-1.5">
            <Label>Conta destino</Label>
            <Select value={f.destination_account_id} onValueChange={(v) => setF({ ...f, destination_account_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {otherAccounts.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Cadastre outra conta ativa</div>}
                {otherAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="col-span-2 space-y-1.5">
          <Label>Descrição</Label>
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Opcional" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min={0.01} required value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Observações</Label>
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} />
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
