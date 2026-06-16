import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Rosé" }] }),
  component: ProductsPage,
});

type Product = {
  id: string; name: string; brand: string | null; category: string | null;
  cost_price: number; sale_price: number; wholesale_price: number;
  stock: number; min_stock: number; sku: string | null;
};

function ProductsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Product>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (editing) {
        const { error } = await supabase.from("products").update(p).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...p, user_id: user.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); setEditing(null);
      toast.success("Produto salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Produtos"
        subtitle="Cadastro de cosméticos e controle de estoque"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground">
                <Plus className="size-4 mr-1" /> Novo produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
              <ProductForm initial={editing} onSubmit={(v) => save.mutate(v)} busy={save.isPending} />
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
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum produto cadastrado ainda.</TableCell></TableRow>
              )}
              {products?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.brand ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(Number(p.cost_price))}</TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(p.sale_price))}</TableCell>
                  <TableCell className="text-right">
                    <span className={p.stock <= p.min_stock ? "text-destructive font-medium" : ""}>{p.stock}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Excluir ${p.name}?`)) remove.mutate(p.id); }}><Trash2 className="size-4 text-destructive" /></Button>
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

function ProductForm({ initial, onSubmit, busy }: { initial: Product | null; onSubmit: (v: any) => void; busy: boolean }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    sku: initial?.sku ?? "",
    brand: initial?.brand ?? "",
    category: initial?.category ?? "",
    cost_price: initial?.cost_price ?? 0,
    sale_price: initial?.sale_price ?? 0,
    wholesale_price: initial?.wholesale_price ?? 0,
    stock: initial?.stock ?? 0,
    min_stock: initial?.min_stock ?? 3,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nome</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>SKU</Label>
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="código" />
        </div>
        <div className="space-y-1.5">
          <Label>Marca</Label>
          <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Categoria</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="ex: maquiagem, skincare, perfumaria" />
        </div>
        <div className="space-y-1.5">
          <Label>Preço de custo (R$)</Label>
          <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Preço varejo (R$)</Label>
          <Input type="number" step="0.01" required value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Preço atacado (R$)</Label>
          <Input type="number" step="0.01" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: Number(e.target.value) })} placeholder="0 = usa varejo" />
        </div>
        <div className="space-y-1.5">
          <Label>Estoque atual</Label>
          <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Estoque mínimo</Label>
          <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} />
        </div>
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
        {busy ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
