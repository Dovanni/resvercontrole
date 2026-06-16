import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contas-pagar")({
  head: () => ({ meta: [{ title: "Contas a pagar — Rosé" }] }),
  component: PayablesPage,
});

const CATEGORIES = ["fornecedor", "logistica", "marketing", "aluguel", "impostos", "outros"];

type Payable = {
  id: string; supplier_id: string | null; description: string; category: string;
  amount: number; due_date: string; payment_method: string | null;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  paid_amount: number; paid_at: string | null;
  recurrence: "nenhuma" | "semanal" | "mensal";
  suppliers?: { name: string } | null;
};

function PayablesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["payables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("*, suppliers(name)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as Payable[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const totals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pending = (data ?? []).filter(p => p.status === "pendente");
    const overdue = pending.filter(p => p.due_date < today);
    return {
      pendingAmount: pending.reduce((s, p) => s + Number(p.amount), 0),
      overdueCount: overdue.length,
      paidThisMonth: (data ?? [])
        .filter(p => p.status === "pago" && p.paid_at?.slice(0, 7) === new Date().toISOString().slice(0, 7))
        .reduce((s, p) => s + Number(p.paid_amount || p.amount), 0),
    };
  }, [data]);

  const markPaid = useMutation({
    mutationFn: async (p: Payable) => {
      const { error } = await supabase.from("payables").update({
        status: "pago", paid_amount: p.amount, paid_at: new Date().toISOString(),
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payables"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Conta paga e registrada no financeiro");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("payables").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables"] }); toast.success("Removido"); },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Contas a pagar"
        subtitle="Despesas, fornecedores e compromissos"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Nova conta a pagar</DialogTitle></DialogHeader>
              <PayableForm
                suppliers={suppliers ?? []}
                onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["payables"] }); }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display">{brl(totals.pendingAmount)}</div>
          <div className="text-xs text-muted-foreground mt-1">Em aberto</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display text-destructive">{totals.overdueCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Em atraso</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display">{brl(totals.paidThisMonth)}</div>
          <div className="text-xs text-muted-foreground mt-1">Pago este mês</div>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma conta cadastrada.</TableCell></TableRow>
              )}
              {data?.map(p => {
                const overdue = p.status === "pendente" && p.due_date < today;
                return (
                  <TableRow key={p.id}>
                    <TableCell className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {new Date(p.due_date + "T00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{p.description}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground text-sm">{p.category}</TableCell>
                    <TableCell>
                      <StatusBadge status={overdue ? "atrasado" : p.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">{brl(Number(p.amount))}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p.status !== "pago" && p.status !== "cancelado" && (
                        <Button variant="ghost" size="icon" title="Marcar como pago" onClick={() => markPaid.mutate(p)}>
                          <CheckCircle2 className="size-4 text-success" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) remove.mutate(p.id); }}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente: "bg-accent text-accent-foreground",
    pago: "bg-success/15 text-success",
    atrasado: "bg-destructive/15 text-destructive",
    cancelado: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full capitalize ${map[status]}`}>
      {status === "atrasado" && <AlertCircle className="size-3" />}
      {status}
    </span>
  );
}

function PayableForm({ suppliers, onDone }: { suppliers: { id: string; name: string }[]; onDone: () => void }) {
  const [f, setF] = useState({
    supplier_id: "", description: "", category: "fornecedor",
    amount: 0, due_date: new Date().toISOString().slice(0, 10),
    payment_method: "pix", recurrence: "nenhuma" as const,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("payables").insert({
        ...f, supplier_id: f.supplier_id || null, user_id: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conta criada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Descrição</Label>
          <Input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Fornecedor</Label>
          <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" required min={0.01} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Vencimento</Label>
          <Input type="date" required value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["pix", "boleto", "transferência", "dinheiro", "cartão"].map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Recorrência</Label>
          <Select value={f.recurrence} onValueChange={(v: any) => setF({ ...f, recurrence: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhuma">Nenhuma</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
