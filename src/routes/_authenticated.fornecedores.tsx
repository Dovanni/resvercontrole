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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { DataPagination, usePagination } from "@/components/data-pagination";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — Rosé" }] }),
  component: SuppliersPage,
});

type Supplier = {
  id: string; name: string; document: string | null; contact_name: string | null;
  phone: string | null; email: string | null; delivery_days: number | null;
  payment_terms: string | null; notes: string | null;
};

function SuppliersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const { data } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { page, setPage, totalPages, total, pageItems } = usePagination(data);


  const save = useMutation({
    mutationFn: async (v: Partial<Supplier>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (editing) {
        const { error } = await supabase.from("suppliers").update(v).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ ...v, user_id: user.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setOpen(false); setEditing(null); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("suppliers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Fornecedores"
        subtitle="Quem abastece seu negócio"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setShowHelp(true)}>
              <HelpCircle className="size-4 mr-1" /> Como funciona esta etapa
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Novo fornecedor</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo"} fornecedor</DialogTitle></DialogHeader>
                <SupplierForm initial={editing} onSubmit={(v) => save.mutate(v)} busy={save.isPending} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">🏢 Fornecedores — Cadastro e Gestão dos Parceiros Comerciais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo desta etapa</h3>
              <p>O módulo Fornecedores é responsável pelo cadastro, organização e gerenciamento das empresas e prestadores de serviços que abastecem o negócio. Mantém uma base de dados completa e atualizada dos parceiros comerciais, permitindo controlar compras, prazos, condições comerciais e alimentar automaticamente os demais módulos do Rosé.</p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">📌 O que pode ser feito</h3>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Cadastrar novos fornecedores</li>
                <li>Editar informações cadastrais</li>
                <li>Consultar e excluir fornecedores</li>
                <li>Registrar CNPJ, contatos e prazos de pagamento</li>
                <li>Organizar a base para apoiar Compras e Financeiro</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">🔄 Fluxo recomendado</h3>
              <ol className="list-decimal pl-5 space-y-0.5">
                <li>Cadastrar novo fornecedor (Razão Social, CNPJ, contato, telefone, e-mail, endereço, prazo, observações)</li>
                <li>Conferir dados (nome, CNPJ, contato, prazo negociado)</li>
                <li>Atualizar informações sempre que necessário</li>
                <li>Utilizar nas compras — disponível automaticamente no módulo Compras</li>
                <li>Acompanhar o relacionamento comercial (negociações, histórico, controle financeiro)</li>
              </ol>
            </section>
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo do resultado</h3>
              <p>Base organizada e confiável de fornecedores. Alimenta automaticamente: Compras, Contas a Pagar, Financeiro, Fluxo de Caixa, Business Intelligence, Dashboard e Relatórios Gerenciais.</p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">📈 Como interpretar os dados</h3>
              <ul className="list-disc pl-5 space-y-0.5">
                <li><strong>Nome:</strong> identifica o fornecedor</li>
                <li><strong>CNPJ:</strong> identificação jurídica</li>
                <li><strong>Contato:</strong> facilita comunicação e negociações</li>
                <li><strong>Prazo:</strong> prazo médio para pagamento das compras — auxilia no planejamento financeiro</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Manter dados sempre atualizados</li>
                <li>Evitar cadastros duplicados</li>
                <li>Conferir CNPJ antes do cadastro</li>
                <li>Atualizar contatos periodicamente</li>
                <li>Revisar prazos negociados</li>
                <li>Registrar observações relevantes</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">⚠️ Importante</h3>
              <p>O cadastro de fornecedores é uma das bases operacionais do Rosé. Diversos módulos dependem dessas informações para controlar compras, pagamentos, indicadores financeiros e análises gerenciais.</p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum fornecedor cadastrado.</TableCell></TableRow>
              )}
              {pageItems.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.document ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{[s.contact_name, s.phone].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-sm">{s.delivery_days ? `${s.delivery_days} dias` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (await confirm({ title: "Excluir fornecedor?", description: `O fornecedor "${s.name}" será removido permanentemente.` })) remove.mutate(s.id);
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

function SupplierForm({ initial, onSubmit, busy }: { initial: Supplier | null; onSubmit: (v: any) => void; busy: boolean }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", document: initial?.document ?? "",
    contact_name: initial?.contact_name ?? "", phone: initial?.phone ?? "",
    email: initial?.email ?? "", delivery_days: initial?.delivery_days ?? 0,
    payment_terms: initial?.payment_terms ?? "", notes: initial?.notes ?? "",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Razão social</Label>
          <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>CNPJ</Label>
          <Input value={f.document} onChange={(e) => setF({ ...f, document: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Contato</Label>
          <Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Prazo de entrega (dias)</Label>
          <Input type="number" value={f.delivery_days ?? 0} onChange={(e) => setF({ ...f, delivery_days: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Condição de pagamento</Label>
          <Input value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })} placeholder="ex: 30/60/90" />
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
