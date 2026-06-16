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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Rosé" }] }),
  component: SalesPage,
});

const PAYMENT_METHODS = ["dinheiro", "pix", "cartão débito", "cartão crédito", "boleto", "a prazo"];
const STATUSES = ["orcamento", "confirmado", "separacao", "enviado", "entregue", "cancelado"] as const;
const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento", confirmado: "Confirmado", separacao: "Em separação",
  enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado",
};

function SalesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: sales } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,customer_name,channel,status,payment_method,total,discount,sold_at, customers(name), sale_items(quantity, products(name))")
        .order("sold_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Vendas"
        subtitle="Pedidos de atacado e varejo"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Nova venda</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">Nova venda</DialogTitle></DialogHeader>
              <NewSaleForm
                onDone={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["sales"] });
                  qc.invalidateQueries({ queryKey: ["products"] });
                  qc.invalidateQueries({ queryKey: ["dashboard"] });
                  qc.invalidateQueries({ queryKey: ["finance"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma venda ainda.</TableCell></TableRow>
              )}
              {sales?.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{dateBR(s.sold_at)}</TableCell>
                  <TableCell className="font-medium">{s.customers?.name ?? s.customer_name ?? "Balcão"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${s.channel === "atacado" ? "bg-gold/15 text-gold-foreground" : "bg-accent text-accent-foreground"}`}>
                      {s.channel}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {(s.sale_items ?? []).map((i: any) => `${i.quantity}× ${i.products?.name}`).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{STATUS_LABEL[s.status] ?? s.status}</TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(s.total))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type Product = { id: string; name: string; sale_price: number; wholesale_price: number; cost_price: number; stock: number };
type LineItem = { product_id: string; quantity: number; unit_price: number; unit_cost: number; name: string; max: number };

function NewSaleForm({ onDone }: { onDone: () => void }) {
  const { data: products } = useQuery({
    queryKey: ["products-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sale_price,wholesale_price,cost_price,stock")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name,customer_type").eq("status", "ativo").order("name");
      if (error) throw error;
      return data as { id: string; name: string; customer_type: "varejo" | "atacado" }[];
    },
  });

  const [customerId, setCustomerId] = useState<string>("");
  const [walkInName, setWalkInName] = useState("");
  const [channel, setChannel] = useState<"varejo" | "atacado">("varejo");
  const [status, setStatus] = useState<typeof STATUSES[number]>("confirmado");
  const [method, setMethod] = useState("dinheiro");
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);

  const priceFor = (p: Product) =>
    channel === "atacado" && Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.sale_price);

  const total = useMemo(
    () => Math.max(0, items.reduce((s, i) => s + i.quantity * i.unit_price, 0) - discount),
    [items, discount]
  );

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers?.find(x => x.id === id);
    if (c) setChannel(c.customer_type);
  }

  function addProduct(id: string) {
    const p = products?.find(x => x.id === id);
    if (!p) return;
    if (items.some(i => i.product_id === id)) return toast.info("Produto já adicionado");
    if (p.stock <= 0) return toast.error("Sem estoque");
    setItems(prev => [...prev, {
      product_id: p.id, quantity: 1, unit_price: priceFor(p),
      unit_cost: Number(p.cost_price), name: p.name, max: p.stock,
    }]);
  }

  // recalc prices when channel changes
  function changeChannel(c: "varejo" | "atacado") {
    setChannel(c);
    setItems(items.map(i => {
      const p = products?.find(x => x.id === i.product_id);
      return p ? { ...i, unit_price: c === "atacado" && Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.sale_price) } : i;
    }));
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error("Adicione ao menos um produto");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const selected = customers?.find(c => c.id === customerId);
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          user_id: user.id,
          customer_id: customerId || null,
          customer_name: selected?.name ?? (walkInName || null),
          channel, status, payment_method: method, total, discount,
        } as any)
        .select().single();
      if (error) throw error;
      const rows = items.map(i => ({
        sale_id: sale.id, user_id: user.id, product_id: i.product_id,
        quantity: i.quantity, unit_price: i.unit_price, unit_cost: i.unit_cost,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(rows as any);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Venda registrada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cliente cadastrado</Label>
          <Select value={customerId} onValueChange={pickCustomer}>
            <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
            <SelectContent>
              {customers?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name} <span className="text-muted-foreground">· {c.customer_type}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ou nome (balcão)</Label>
          <Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} disabled={!!customerId} placeholder="Ex: Maria" />
        </div>
        <div className="space-y-1.5">
          <Label>Canal</Label>
          <Select value={channel} onValueChange={(v: any) => changeChannel(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="varejo">Varejo</SelectItem>
              <SelectItem value="atacado">Atacado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Adicionar produto</Label>
        <Select value="" onValueChange={addProduct}>
          <SelectTrigger><SelectValue placeholder="Selecionar produto…" /></SelectTrigger>
          <SelectContent>
            {products?.map(p => (
              <SelectItem key={p.id} value={p.id} disabled={p.stock <= 0}>
                {p.name} — {brl(priceFor(p))} ({p.stock} em estoque)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length > 0 && (
        <div className="rounded-lg border divide-y">
          {items.map((it, idx) => (
            <div key={it.product_id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                <div className="text-xs text-muted-foreground">{brl(it.unit_price)} × {it.quantity} = {brl(it.unit_price * it.quantity)}</div>
              </div>
              <Input type="number" min={1} max={it.max} value={it.quantity}
                onChange={(e) => {
                  const q = Math.min(it.max, Math.max(1, Number(e.target.value)));
                  setItems(items.map((x, i) => i === idx ? { ...x, quantity: q } : x));
                }}
                className="w-20"
              />
              <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Desconto (R$)</Label>
          <Input type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="font-display text-3xl">{brl(total)}</div>
        </div>
      </div>

      <Button onClick={() => submit.mutate()} disabled={submit.isPending || items.length === 0}
        className="w-full bg-gradient-primary text-primary-foreground">
        {submit.isPending ? "Registrando…" : "Registrar venda"}
      </Button>
    </div>
  );
}
