import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Upload, Package, Search, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { useConfirm } from "@/components/confirm-dialog";
import { DataPagination, usePagination } from "@/components/data-pagination";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Rosé" }] }),
  component: ProductsPage,
});

type Product = {
  id: string; name: string; brand: string | null; category: string | null;
  cost_price: number; sale_price: number; wholesale_price: number;
  stock: number; min_stock: number; sku: string | null; photo_url: string | null;
  status?: string;
};

type SortKey = "name" | "brand";
type SortDir = "asc" | "desc";

function ProductsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
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

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const brands = useMemo(
    () => Array.from(new Set((products ?? []).map(p => p.brand).filter((b): b is string => !!b))).sort(),
    [products]
  );
  const categories = useMemo(
    () => Array.from(new Set((products ?? []).map(p => p.category).filter((c): c is string => !!c))).sort(),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (products ?? []).filter(p => {
      if (q) {
        const hay = `${p.name ?? ""} ${p.sku ?? ""} ${p.brand ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (brandFilter !== "all" && (p.brand ?? "") !== brandFilter) return false;
      if (categoryFilter !== "all" && (p.category ?? "") !== categoryFilter) return false;
      if (statusFilter !== "all") {
        const s = (p.status ?? "ativo").toLowerCase();
        if (statusFilter === "ativo" && s !== "ativo") return false;
        if (statusFilter === "inativo" && s === "ativo") return false;
      }
      if (stockFilter !== "all") {
        const stock = Number(p.stock ?? 0);
        const min = Number(p.min_stock ?? 0);
        if (stockFilter === "zerado" && stock !== 0) return false;
        if (stockFilter === "baixo" && !(stock > 0 && stock <= min)) return false;
        if (stockFilter === "normal" && !(stock > min)) return false;
      }
      return true;
    });
    const sorted = [...list].sort((a, b) => {
      const av = (a[sortKey] ?? "").toString().toLowerCase();
      const bv = (b[sortKey] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv, "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [products, search, brandFilter, categoryFilter, statusFilter, stockFilter, sortKey, sortDir]);

  const { page, setPage, totalPages, total, pageItems } = usePagination(filtered);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const clearFilters = () => {
    setSearch(""); setBrandFilter("all"); setCategoryFilter("all");
    setStatusFilter("all"); setStockFilter("all");
  };

  const hasActiveFilters = search || brandFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all" || stockFilter !== "all";

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="size-3 inline ml-1 opacity-50" />
    : sortDir === "asc" ? <ArrowUp className="size-3 inline ml-1" />
    : <ArrowDown className="size-3 inline ml-1" />;



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
                <TableHead className="w-16"></TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum produto cadastrado ainda.</TableCell></TableRow>
              )}
              {pageItems.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="size-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                      {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="size-4 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.brand ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(Number(p.cost_price))}</TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(p.sale_price))}</TableCell>
                  <TableCell className="text-right">
                    <span className={p.stock <= p.min_stock ? "text-destructive font-medium" : ""}>{p.stock}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (await confirm({ title: "Excluir produto?", description: `O produto "${p.name}" será removido permanentemente.` })) remove.mutate(p.id);
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

function ProductForm({ initial, onSubmit, busy }: { initial: Product | null; onSubmit: (v: any) => void; busy: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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
    photo_url: initial?.photo_url ?? "",
  });

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("product-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed?.signedUrl) setForm((f) => ({ ...f, photo_url: signed.signedUrl }));
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="flex items-center gap-4">
        <div className="size-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center">
          {form.photo_url ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" /> : <Package className="size-7 text-muted-foreground" />}
        </div>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="size-4 mr-1" /> {uploading ? "Enviando…" : "Foto do produto"}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
        </div>
      </div>
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
