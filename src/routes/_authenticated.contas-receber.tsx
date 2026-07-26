import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
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
import { CheckCircle2, AlertCircle, Download, Plus, Clock, Pencil, Trash2, Check, X, HelpCircle } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";
import { DataPagination, usePagination } from "@/components/data-pagination";

export const Route = createFileRoute("/_authenticated/contas-receber")({
  head: () => ({ meta: [{ title: "Contas a receber — Vejamais" }] }),
  component: ReceivablesPage,
});

type Receivable = {
  id: string;
  customer_id: string | null;
  description: string;
  amount: number;
  received_amount: number;
  due_date: string;
  received_at: string | null;
  payment_method: string | null;
  status: "pendente" | "recebido" | "parcial" | "atrasado" | "cancelado";
  customers?: { name: string } | null;
};

function effectiveStatus(r: Receivable): Receivable["status"] {
  if (r.status === "recebido" || r.status === "cancelado") return r.status;
  const rec = Number(r.received_amount);
  const tot = Number(r.amount);
  if (rec >= tot && tot > 0) return "recebido";
  if (rec > 0) return "parcial";
  if (new Date(r.due_date) < new Date(new Date().toDateString())) return "atrasado";
  return "pendente";
}

const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  parcial: "bg-warning/10 text-warning",
  recebido: "bg-success/10 text-success",
  atrasado: "bg-destructive/10 text-destructive",
  cancelado: "bg-muted text-muted-foreground line-through",
};

function ReceivablesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [customerFilter, setCustomerFilter] = useState<string>("todos");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [openNew, setOpenNew] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [payTarget, setPayTarget] = useState<Receivable | null>(null);
  const [editTarget, setEditTarget] = useState<Receivable | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables" as any)
        .select("*, customers(name)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as unknown as Receivable[];
    },
  });

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r) => {
      const eff = effectiveStatus(r);
      if (statusFilter !== "todos" && eff !== statusFilter) return false;
      if (customerFilter !== "todos" && r.customer_id !== customerFilter) return false;
      if (fromDate && r.due_date < fromDate) return false;
      if (toDate && r.due_date > toDate) return false;
      return true;
    });
  }, [rows, statusFilter, customerFilter, fromDate, toDate]);

  const totals = useMemo(() => {
    let pending = 0, received = 0, overdue = 0;
    for (const r of filtered) {
      const remaining = Number(r.amount) - Number(r.received_amount);
      received += Number(r.received_amount);
      const eff = effectiveStatus(r);
      if (eff === "atrasado") overdue += remaining;
      else if (eff !== "recebido" && eff !== "cancelado") pending += remaining;
    }
    return { pending, received, overdue };
  }, [filtered]);

  const { page, setPage, totalPages, total, pageItems } = usePagination(filtered);

  const exportXlsx = () => {
    const rows = filtered.map((r) => ({
      Vencimento: dateBR(r.due_date),
      Cliente: r.customers?.name ?? "—",
      Descrição: r.description,
      Valor: Number(r.amount),
      Recebido: Number(r.received_amount),
      Saldo: Number(r.amount) - Number(r.received_amount),
      Status: effectiveStatus(r),
      "Recebido em": r.received_at ? dateBR(r.received_at) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a receber");
    XLSX.writeFile(wb, `contas-receber-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Contas a receber"
        subtitle="Acompanhe pagamentos pendentes dos clientes"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)}>
              <HelpCircle className="size-4 mr-1" /> Como funciona
            </Button>
            <Button variant="outline" onClick={exportXlsx}><Download className="size-4 mr-1" /> Excel</Button>
            <Button className="bg-gradient-primary text-primary-foreground" onClick={() => setOpenNew(true)}>
              <Plus className="size-4 mr-1" /> Nova conta
            </Button>
          </div>
        }
      />

      <HelpDialog open={showHelp} onOpenChange={setShowHelp} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-muted text-muted-foreground items-center justify-center mb-3"><Clock className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.pending)}</div>
          <div className="text-xs text-muted-foreground mt-1">A receber</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-destructive/10 text-destructive items-center justify-center mb-3"><AlertCircle className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.overdue)}</div>
          <div className="text-xs text-muted-foreground mt-1">Em atraso</div>
        </CardContent></Card>
        <Card className="shadow-soft bg-gradient-rose"><CardContent className="p-5">
          <div className="inline-flex size-10 rounded-xl bg-success/10 text-success items-center justify-center mb-3"><CheckCircle2 className="size-5" /></div>
          <div className="text-2xl font-display">{brl(totals.received)}</div>
          <div className="text-xs text-muted-foreground mt-1">Recebido</div>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft mb-4"><CardContent className="p-4 grid md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cliente</Label>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Vencimento de</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Vencimento até</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </CardContent></Card>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Sem contas a receber.</TableCell></TableRow>
              )}
              {pageItems.map((r) => {
                const eff = effectiveStatus(r);
                const remaining = Number(r.amount) - Number(r.received_amount);

                const inlineSave = async (patch: Partial<Receivable>) => {
                  const { error } = await supabase.from("receivables" as any).update(patch as any).eq("id", r.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Atualizado!");
                  qc.invalidateQueries({ queryKey: ["receivables"] });
                };

                const handleDelete = async () => {
                  const hasRecv = Number(r.received_amount) > 0;
                  const ok = await confirm({
                    title: hasRecv ? "Conta já recebida" : "Excluir conta a receber?",
                    description: hasRecv
                      ? `Esta conta já foi recebida. Excluir irá estornar a entrada na conta bancária. Confirmar?`
                      : `Excluir a conta a receber de ${r.customers?.name ?? "—"} no valor de ${brl(Number(r.amount))}? Esta ação não pode ser desfeita.`,
                    confirmText: hasRecv ? "Excluir e estornar" : "Excluir",
                    destructive: true,
                  });
                  if (!ok) return;
                  // Estornar movimentos bancários gerados por esta receivable
                  await supabase.from("bank_movements" as any).delete().eq("origin", "receivable").eq("reference_id", r.id);
                  const { error } = await supabase.from("receivables" as any).delete().eq("id", r.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Excluído!");
                  qc.invalidateQueries({ queryKey: ["receivables"] });
                  qc.invalidateQueries({ queryKey: ["finance"] });
                  qc.invalidateQueries({ queryKey: ["cashflow"] });
                };

                return (
                  <TableRow key={r.id} className="animate-in fade-in">
                    <TableCell>
                      <InlineEdit
                        value={r.due_date}
                        type="date"
                        display={dateBR(r.due_date)}
                        onSave={(v) => inlineSave({ due_date: v as any })}
                      />
                    </TableCell>
                    <TableCell>{r.customers?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <InlineEdit
                        value={r.description}
                        type="text"
                        display={r.description}
                        onSave={(v) => inlineSave({ description: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <InlineEdit
                        value={String(r.amount)}
                        type="number"
                        display={brl(Number(r.amount))}
                        onSave={(v) => inlineSave({ amount: Number(v) as any })}
                      />
                    </TableCell>
                    <TableCell className="text-right text-success">{brl(Number(r.received_amount))}</TableCell>
                    <TableCell className="text-right font-medium">{brl(remaining)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS_STYLE[eff]}`}>{eff}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditTarget(r)} title="Editar"><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={handleDelete} title="Excluir"><Trash2 className="size-4 text-destructive" /></Button>
                        {eff !== "recebido" && eff !== "cancelado" && (
                          <Button size="sm" variant="outline" onClick={() => setPayTarget(r)}>Baixar</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <DataPagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nova conta a receber</DialogTitle></DialogHeader>
          <NewReceivableForm customers={customers ?? []} onDone={() => {
            setOpenNew(false);
            qc.invalidateQueries({ queryKey: ["receivables"] });
          }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Registrar recebimento</DialogTitle></DialogHeader>
          {payTarget && (
            <ReceivePaymentForm
              receivable={payTarget}
              onDone={() => {
                setPayTarget(null);
                qc.invalidateQueries({ queryKey: ["receivables"] });
                qc.invalidateQueries({ queryKey: ["finance"] });
                qc.invalidateQueries({ queryKey: ["cashflow"] });
                qc.invalidateQueries({ queryKey: ["dashboard"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Editar conta a receber</DialogTitle></DialogHeader>
          {editTarget && (
            <EditReceivableForm
              receivable={editTarget}
              customers={customers ?? []}
              onDone={() => {
                setEditTarget(null);
                qc.invalidateQueries({ queryKey: ["receivables"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InlineEdit({ value, type, display, onSave }: {
  value: string; type: "text" | "number" | "date"; display: React.ReactNode; onSave: (v: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="hover:underline cursor-pointer text-left w-full">
        {display}
      </button>
    );
  }
  const commit = async () => { setEditing(false); if (v !== value) await onSave(v); };
  const cancel = () => { setV(value); setEditing(false); };
  return (
    <div className="inline-flex items-center gap-1">
      <Input
        autoFocus
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") cancel(); }}
        className="h-7 text-xs w-32"
      />
      <button type="button" onClick={commit} className="text-success"><Check className="size-4" /></button>
      <button type="button" onClick={cancel} className="text-destructive"><X className="size-4" /></button>
    </div>
  );
}

function EditReceivableForm({ receivable, customers, onDone }: { receivable: Receivable; customers: any[]; onDone: () => void }) {
  const [customer_id, setCustomerId] = useState<string>(receivable.customer_id ?? "");
  const [description, setDescription] = useState(receivable.description);
  const [amount, setAmount] = useState(Number(receivable.amount));
  const [due_date, setDueDate] = useState(receivable.due_date);
  const [payment_method, setPaymentMethod] = useState(receivable.payment_method ?? "boleto");
  const [bank_account_id, setBankAccountId] = useState<string>((receivable as any).bank_account_id ?? "");
  const [status, setStatus] = useState<string>(receivable.status);

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts" as any).select("id,name,bank,color").eq("status", "ativa").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string }[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("receivables" as any).update({
        customer_id: customer_id || null,
        description, amount, due_date, payment_method,
        bank_account_id: bank_account_id || null,
        status,
      } as any).eq("id", receivable.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conta atualizada com sucesso!"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Cliente</Label>
        <Select value={customer_id} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Input required value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min={0.01} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Vencimento</Label>
          <Input type="date" required value={due_date} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={payment_method} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="deposito">Depósito bancário</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
              <SelectItem value="cartao_credito">Cartão de crédito</SelectItem>
              <SelectItem value="cartao_debito">Cartão de débito</SelectItem>
              <SelectItem value="cartao">Cartão (parcelado)</SelectItem>
              <SelectItem value="mercado_livre">Venda Mercado Livre</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="pix_prazo">PIX a prazo</SelectItem>
              <SelectItem value="crediario">Crediário</SelectItem>
              <SelectItem value="prazo">A prazo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Conta de destino</Label>
          <Select value={bank_account_id || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Não vincular a uma conta</SelectItem>
              {(bankAccounts ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: b.color }} />
                    {b.name} <span className="text-muted-foreground">— {b.bank}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}

function NewReceivableForm({ customers, onDone }: { customers: any[]; onDone: () => void }) {
  const [customer_id, setCustomerId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [due_date, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [payment_method, setPaymentMethod] = useState("boleto");
  const [bank_account_id, setBankAccountId] = useState<string>("");

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id,name,bank,color")
        .eq("status", "ativa")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string }[];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["routing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_routing_rules" as any).select("payment_method,bank_account_id,fixo");
      if (error) throw error;
      return (data ?? []) as unknown as { payment_method: string; bank_account_id: string | null; fixo: boolean }[];
    },
  });

  const currentRule = useMemo(() => (rules ?? []).find(r => r.payment_method === payment_method), [rules, payment_method]);
  const locked = !!currentRule?.fixo && !!currentRule?.bank_account_id;

  useEffect(() => {
    if (locked) setBankAccountId(currentRule!.bank_account_id!);
    else if (currentRule?.bank_account_id) setBankAccountId(currentRule.bank_account_id);
    else setBankAccountId("");
  }, [locked, currentRule]);

  const accountName = (id: string) => (bankAccounts ?? []).find(b => b.id === id)?.name ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("receivables" as any).insert({
        user_id: user.id, customer_id: customer_id || null, description, amount, due_date, payment_method,
        bank_account_id: bank_account_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conta criada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Cliente</Label>
        <Select value={customer_id} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Input required value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min={0.01} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Vencimento</Label>
          <Input type="date" required value={due_date} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={payment_method} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="deposito">Depósito bancário</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
              <SelectItem value="cartao_credito">Cartão de crédito</SelectItem>
              <SelectItem value="cartao_debito">Cartão de débito</SelectItem>
              <SelectItem value="cartao">Cartão (parcelado)</SelectItem>
              <SelectItem value="mercado_livre">Venda Mercado Livre</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="pix_prazo">PIX a prazo</SelectItem>
              <SelectItem value="crediario">Crediário</SelectItem>
              <SelectItem value="prazo">A prazo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Conta de destino {locked && <span className="text-xs text-muted-foreground">(automático)</span>}</Label>
          {locked ? (
            <Input value={accountName(bank_account_id)} disabled className="bg-muted" />
          ) : (
            <Select value={bank_account_id || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não vincular a uma conta</SelectItem>
                {(bankAccounts ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: b.color }} />
                      {b.name} <span className="text-muted-foreground">— {b.bank}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="text-xs text-muted-foreground">
            {locked ? "Esta forma de pagamento é direcionada automaticamente." : "A movimentação será gerada nesta conta ao registrar o recebimento."}
          </div>
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}


function ReceivePaymentForm({ receivable, onDone }: { receivable: Receivable; onDone: () => void }) {
  const remaining = Number(receivable.amount) - Number(receivable.received_amount);
  const [amount, setAmount] = useState(remaining);
  const [received_at, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [payment_method, setPaymentMethod] = useState<string>(receivable.payment_method || "pix");
  const [bank_account_id, setBankAccountId] = useState<string>("");

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id,name,bank,color")
        .eq("status", "ativa")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string }[];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["routing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_routing_rules" as any).select("payment_method,bank_account_id,fixo");
      if (error) throw error;
      return (data ?? []) as unknown as { payment_method: string; bank_account_id: string | null; fixo: boolean }[];
    },
  });

  const currentRule = useMemo(() => (rules ?? []).find(r => r.payment_method === payment_method), [rules, payment_method]);
  const locked = !!currentRule?.fixo && !!currentRule?.bank_account_id;

  useEffect(() => {
    if (locked) setBankAccountId(currentRule!.bank_account_id!);
    else if (currentRule?.bank_account_id) setBankAccountId(currentRule.bank_account_id);
  }, [locked, currentRule]);

  const save = useMutation({
    mutationFn: async () => {
      if (amount <= 0 || amount > remaining + 0.001) throw new Error("Valor inválido");
      const newReceived = Number(receivable.received_amount) + Number(amount);
      const total = Number(receivable.amount);
      const fullyPaid = newReceived >= total - 0.001;
      const { error } = await supabase
        .from("receivables" as any)
        .update({
          received_amount: newReceived,
          received_at: fullyPaid ? new Date(received_at).toISOString() : receivable.received_at ?? new Date(received_at).toISOString(),
          status: fullyPaid ? "recebido" : "parcial",
          payment_method,
          bank_account_id: bank_account_id || null,
        } as any)
        .eq("id", receivable.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(bank_account_id ? "Recebimento registrado na conta bancária" : "Recebimento registrado"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const accountName = (id: string) => (bankAccounts ?? []).find(b => b.id === id)?.name ?? "";

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="text-sm text-muted-foreground">Saldo restante: <span className="font-medium text-foreground">{brl(remaining)}</span></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor recebido (R$)</Label>
          <Input type="number" step="0.01" min={0.01} max={remaining} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" required value={received_at} onChange={(e) => setReceivedAt(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={payment_method} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="deposito">Depósito bancário</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
              <SelectItem value="cartao_credito">Cartão de crédito</SelectItem>
              <SelectItem value="cartao_debito">Cartão de débito</SelectItem>
              <SelectItem value="cartao">Cartão (parcelado)</SelectItem>
              <SelectItem value="mercado_livre">Venda Mercado Livre</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="pix_prazo">PIX a prazo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Conta destino {locked && <span className="text-xs text-muted-foreground">(automático)</span>}</Label>
          {locked ? (
            <Input value={accountName(bank_account_id)} disabled className="bg-muted" />
          ) : (
            <Select value={bank_account_id || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não vincular a uma conta</SelectItem>
                {(bankAccounts ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: b.color }} />
                      {b.name} <span className="text-muted-foreground">— {b.bank}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="text-xs text-muted-foreground">
            {locked ? "Esta forma de pagamento é direcionada automaticamente." : "Escolha a conta que recebeu o valor."}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setAmount(remaining)}>Total</Button>
        <Button type="submit" disabled={save.isPending} className="flex-1 bg-gradient-primary text-primary-foreground">
          {save.isPending ? "Salvando…" : "Confirmar"}
        </Button>
      </div>
    </form>
  );
}

function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Como funciona Contas a Receber</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold text-base mb-2">📌 Objetivo desta tela</h3>
            <p className="text-muted-foreground">
              Contas a Receber é onde você acompanha todos os valores que seus clientes devem pagar — tanto os já recebidos quanto os pendentes.
            </p>
            <p className="text-muted-foreground mt-2">
              É o controle de <strong>crédito</strong> do seu negócio: tudo que você vendeu mas ainda não recebeu em dinheiro.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">💰 Cards do topo</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="rounded-lg bg-muted/40 border p-3">
                <strong className="text-foreground">🟡 A receber</strong><br />
                Total de valores pendentes que os clientes ainda não pagaram.<br />
                → Atenção: acompanhe de perto para não deixar vencer!
              </div>
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                <strong className="text-foreground">🔴 Em atraso</strong><br />
                Valores com data de vencimento já ultrapassada e ainda não recebidos.<br />
                → Priorize cobrar esses clientes!
              </div>
              <div className="rounded-lg bg-success/5 border border-success/20 p-3">
                <strong className="text-foreground">🟢 Recebido</strong><br />
                Total já recebido no período filtrado — dinheiro que entrou no seu caixa.
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">📋 Tabela de lançamentos</h3>
            <p className="text-muted-foreground mb-2">Colunas:</p>
            <ul className="text-muted-foreground text-xs pl-4 list-disc space-y-1 mb-3">
              <li><strong>Vencimento:</strong> data em que o pagamento deve ser recebido</li>
              <li><strong>Cliente:</strong> quem deve pagar</li>
              <li><strong>Descrição:</strong> referência da venda ou serviço</li>
              <li><strong>Valor:</strong> total a receber</li>
              <li><strong>Recebido:</strong> quanto já foi pago (para recebimentos parciais)</li>
              <li><strong>Saldo:</strong> quanto ainda falta (<code className="text-[11px]">Valor − Recebido</code>)</li>
              <li><strong>Status:</strong> situação atual do lançamento</li>
            </ul>
            <p className="text-muted-foreground mb-2">Status possíveis:</p>
            <ul className="text-muted-foreground text-xs pl-4 list-disc space-y-1">
              <li>🟡 <strong>Pendente</strong> — ainda dentro do prazo</li>
              <li>🔴 <strong>Em atraso</strong> — passou do vencimento</li>
              <li>🟢 <strong>Recebido</strong> — pago integralmente</li>
              <li>🔵 <strong>Parcial</strong> — pago parcialmente</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">⚙️ Como os lançamentos são criados</h3>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs mb-2">
              <strong className="text-foreground">Automático</strong>
              <ul className="pl-4 list-disc mt-1 space-y-0.5 text-muted-foreground">
                <li>✅ Toda venda confirmada (status <em>Confirmado</em> ou superior) gera automaticamente uma conta a receber vinculada ao cliente</li>
                <li>✅ O valor = total da venda</li>
                <li>✅ A conta de destino é definida pela forma de pagamento da venda</li>
              </ul>
            </div>
            <div className="rounded-lg bg-muted/40 border p-3 text-xs">
              <strong className="text-foreground">Manual</strong>
              <ul className="pl-4 list-disc mt-1 space-y-0.5 text-muted-foreground">
                <li>✅ Clique em <strong>+ Nova conta a receber</strong> para lançar manualmente (ex: acordos, parcelamentos avulsos, aportes de recursos financeiros)</li>
              </ul>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">✅ Como dar baixa (receber)</h3>
            <p className="text-muted-foreground mb-2">Ao receber o pagamento do cliente:</p>
            <ol className="text-muted-foreground text-xs pl-4 list-decimal space-y-2">
              <li>Clique no botão <strong>Baixar</strong> na linha do lançamento.</li>
              <li>
                Informe:
                <ul className="pl-4 list-disc mt-1 space-y-0.5">
                  <li>Data do recebimento</li>
                  <li>Valor recebido (total ou parcial)</li>
                  <li>Conta bancária de destino (onde o dinheiro entrou)</li>
                </ul>
              </li>
              <li>
                Ao confirmar:
                <ul className="pl-4 list-disc mt-1 space-y-0.5">
                  <li>Status muda para <strong>Recebido</strong></li>
                  <li>Entra automaticamente no <strong>Financeiro</strong> como <em>entrada</em></li>
                  <li>Saldo da conta bancária escolhida é atualizado</li>
                  <li>Aparece no <strong>Fluxo de Caixa</strong></li>
                </ul>
              </li>
            </ol>
            <div className="mt-3 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs">
              <strong>⚠️ Recebimento parcial:</strong> se o cliente pagou apenas parte, informe o valor recebido — o status vira <strong>Parcial</strong> e o saldo restante continua em aberto até a próxima baixa.
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
