import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { isValidCPF, isValidCNPJ, maskCPF, maskCNPJ } from "@/lib/validators";
import { useConfirm } from "@/components/confirm-dialog";
import { DataPagination, usePagination } from "@/components/data-pagination";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Rosé" }] }),
  component: CustomersPage,
});

type Customer = {
  id: string; name: string; person_type: "pf" | "pj"; document: string | null;
  customer_type: "varejo" | "atacado" | "recursos_financeiros"; email: string | null; phone: string | null;
  zip: string | null; address: string | null; credit_limit: number;
  notes: string | null; status: "ativo" | "inativo";
  aporte_type?: string | null; aporte_notes?: string | null;
};

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  varejo: "Varejo",
  atacado: "Atacado",
  recursos_financeiros: "Recursos Financeiros",
};
const APORTE_TYPES = [
  { value: "investidor", label: "Investidor" },
  { value: "emprestimo_familiar", label: "Empréstimo familiar" },
  { value: "socio", label: "Sócio" },
  { value: "recurso_proprio", label: "Recurso próprio" },
  { value: "outro", label: "Outro" },
];

function CustomersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const { data } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { page, setPage, totalPages, total, pageItems } = usePagination(data);

  const save = useMutation({
    mutationFn: async (v: Partial<Customer>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (editing) {
        const { error } = await supabase.from("customers").update(v).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...v, user_id: user.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false); setEditing(null);
      toast.success("Cliente salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Clientes"
        subtitle="Atacado e varejo"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Novo cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo"} cliente</DialogTitle></DialogHeader>
              <CustomerForm initial={editing} onSubmit={(v) => save.mutate(v)} busy={save.isPending} />
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Limite</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum cliente cadastrado.</TableCell></TableRow>
              )}
              {pageItems.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.name}
                    {c.status === "inativo" && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      c.customer_type === "atacado" ? "bg-gold/15 text-gold-foreground"
                      : c.customer_type === "recursos_financeiros" ? "bg-primary/15 text-primary"
                      : "bg-accent text-accent-foreground"
                    }`}>
                      {CUSTOMER_TYPE_LABEL[c.customer_type] ?? c.customer_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.document ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.phone ?? c.email ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(Number(c.credit_limit))}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (await confirm({ title: "Excluir cliente?", description: `O cliente "${c.name}" será removido permanentemente.` })) remove.mutate(c.id);
                    }}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataPagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerForm({ initial, onSubmit, busy }: { initial: Customer | null; onSubmit: (v: any) => void; busy: boolean }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", person_type: initial?.person_type ?? "pf",
    document: initial?.document ?? "", customer_type: initial?.customer_type ?? "varejo",
    email: initial?.email ?? "", phone: initial?.phone ?? "",
    zip: initial?.zip ?? "", address: initial?.address ?? "",
    credit_limit: initial?.credit_limit ?? 0, notes: initial?.notes ?? "",
    status: initial?.status ?? "ativo",
    aporte_type: initial?.aporte_type ?? "",
    aporte_notes: initial?.aporte_notes ?? "",
  });

  async function lookupCep() {
    const cep = f.zip.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j.erro) return toast.error("CEP não encontrado");
      setF({ ...f, address: `${j.logradouro}, ${j.bairro}, ${j.localidade} - ${j.uf}` });
    } catch { toast.error("Falha ao buscar CEP"); }
  }

  const docValid = !f.document || (f.person_type === "pj" ? isValidCNPJ(f.document) : isValidCPF(f.document));
  const onDocChange = (v: string) => setF({ ...f, document: f.person_type === "pj" ? maskCNPJ(v) : maskCPF(v) });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!docValid) { toast.error(`${f.person_type === "pj" ? "CNPJ" : "CPF"} inválido`); return; }
        onSubmit(f);
      }}
      className="space-y-3 max-h-[70vh] overflow-y-auto pr-1"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nome / Razão social</Label>
          <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Pessoa</Label>
          <Select value={f.person_type} onValueChange={(v: any) => setF({ ...f, person_type: v, document: "" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pf">Física (CPF)</SelectItem>
              <SelectItem value="pj">Jurídica (CNPJ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{f.person_type === "pj" ? "CNPJ" : "CPF"}</Label>
          <Input
            value={f.document}
            onChange={(e) => onDocChange(e.target.value)}
            placeholder={f.person_type === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
            className={!docValid ? "border-destructive" : ""}
          />
          {!docValid && <p className="text-xs text-destructive">Documento inválido</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Canal</Label>
          <Select value={f.customer_type} onValueChange={(v: any) => setF({ ...f, customer_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="varejo">Varejo</SelectItem>
              <SelectItem value="atacado">Atacado</SelectItem>
              <SelectItem value="recursos_financeiros">Recursos Financeiros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {f.customer_type === "recursos_financeiros" && (
          <>
            <div className="col-span-2 space-y-1.5">
              <Label>Tipo de aporte</Label>
              <Select value={f.aporte_type || "investidor"} onValueChange={(v) => setF({ ...f, aporte_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APORTE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações sobre o recurso</Label>
              <Textarea rows={2} value={f.aporte_notes} onChange={(e) => setF({ ...f, aporte_notes: e.target.value })} placeholder="Detalhes do investidor, condições do empréstimo, etc." />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v: any) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone / WhatsApp</Label>
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>CEP</Label>
          <Input value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })} onBlur={lookupCep} placeholder="00000-000" />
        </div>
        <div className="space-y-1.5">
          <Label>Limite de crédito (R$)</Label>
          <Input type="number" step="0.01" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: Number(e.target.value) })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Endereço</Label>
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Observações</Label>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
        {busy ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
