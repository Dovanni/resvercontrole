import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Eye, HelpCircle } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { brl, dateBR } from "@/lib/format";
import { DataPagination, usePagination } from "@/components/data-pagination";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Rosé" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ edit: typeof s.edit === "string" ? s.edit : undefined }),
  component: SalesPage,
});

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "deposito", label: "Depósito bancário" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao", label: "Cartão (parcelado)" },
  { value: "mercado_livre", label: "Venda Mercado Livre" },
  { value: "boleto", label: "Boleto" },
  { value: "pix_prazo", label: "PIX a prazo" },
  { value: "crediario", label: "Crediário" },
  { value: "prazo", label: "A prazo" },
];
const PM_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]));
const STATUSES = ["orcamento", "confirmado", "separacao", "enviado", "entregue", "cancelado"] as const;
const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento", confirmado: "Confirmado", separacao: "Em separação",
  enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado",
};
const APORTE_TYPES = [
  { value: "investidor", label: "Investidor" },
  { value: "emprestimo_familiar", label: "Empréstimo familiar" },
  { value: "socio", label: "Sócio" },
  { value: "recurso_proprio", label: "Recurso próprio" },
  { value: "outro", label: "Outro" },
];
const CHANNEL_LABEL: Record<string, string> = {
  varejo: "Varejo", atacado: "Atacado", recursos_financeiros: "Recursos Financeiros",
};


function SalesPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (search.edit) {
      setEditingId(search.edit);
      navigate({ search: { edit: undefined } as any, replace: true });
    }
  }, [search.edit]);

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

  const { page, setPage, totalPages, total, pageItems } = usePagination(sales as any[] | undefined);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["finance"] });
    qc.invalidateQueries({ queryKey: ["bank-movements"] });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Vendas"
        subtitle="Pedidos de atacado e varejo"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)}>
              <HelpCircle className="size-4 mr-1" /> Como funciona esta etapa
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Nova venda</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-display">Nova venda</DialogTitle></DialogHeader>
                <SaleForm onDone={() => { setOpen(false); invalidate(); }} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Editar venda</DialogTitle></DialogHeader>
          {editingId && <SaleForm saleId={editingId} onDone={() => { setEditingId(null); invalidate(); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingId} onOpenChange={(o) => !o && setViewingId(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Resumo da venda</DialogTitle></DialogHeader>
          {viewingId && <SaleView saleId={viewingId} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">📖 Vendas no Rosé — Gestão de Vendas</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="font-semibold mb-1">📌 Objetivo desta etapa</h3>
              <p className="text-muted-foreground">
                O módulo <b>Vendas</b> é responsável por registrar todas as vendas realizadas pela empresa,
                garantindo o controle completo do processo comercial, atualização automática dos indicadores
                financeiros e geração das informações utilizadas pelo BI do Rosé. Cada venda registrada
                representa uma operação comercial efetivamente realizada entre a empresa e o cliente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">🛠️ O que pode ser feito nesta etapa</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Registrar novas vendas</li>
                <li>Consultar vendas já realizadas</li>
                <li>Visualizar detalhes completos de cada pedido</li>
                <li>Editar informações da venda quando permitido</li>
                <li>Acompanhar status dos pedidos</li>
                <li>Controlar vendas de Atacado e Varejo</li>
                <li>Consultar histórico comercial</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">🔁 Fluxo recomendado</h3>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>
                  <b>Selecionar o cliente</b> — escolha um cliente previamente cadastrado. Caso não exista,
                  realize primeiro o cadastro do cliente.
                </li>
                <li>
                  <b>Informar os produtos</b> — adicione todos os produtos vendidos, informando quantidade,
                  valor unitário e descontos (quando houver).
                </li>
                <li>
                  <b>Definir o canal da venda</b> — selecione <b>Atacado</b> ou <b>Varejo</b>. Essa
                  informação é utilizada pelos relatórios e indicadores do BI.
                </li>
                <li>
                  <b>Informar forma de pagamento</b> — PIX, Dinheiro, Cartão, Transferência ou outros meios
                  disponíveis.
                </li>
                <li>
                  <b>Confirmar a venda</b> — após salvar, a venda é registrada, o faturamento atualizado, o
                  estoque movimentado (quando aplicável) e o BI atualizado automaticamente.
                </li>
              </ol>
            </section>

            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo do resultado</h3>
              <p className="text-muted-foreground">
                Ao final desta etapa o Rosé possuirá um registro completo da venda contendo: cliente,
                produtos vendidos, quantidades, valores, canal de venda, forma de pagamento, status e total
                da operação.
              </p>
              <p className="text-muted-foreground mt-2">Essas informações alimentam automaticamente:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Dashboard</li>
                <li>Business Intelligence (BI)</li>
                <li>Fluxo de Caixa</li>
                <li>Financeiro</li>
                <li>Curva ABC</li>
                <li>Indicadores Comerciais</li>
                <li>Relatórios Gerenciais</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Registrar somente vendas efetivamente realizadas</li>
                <li>Conferir valores antes da confirmação</li>
                <li>Manter os cadastros de clientes e produtos sempre atualizados</li>
                <li>Evitar alterações em vendas já concluídas, preservando a consistência dos relatórios</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">⚠️ Importante</h3>
              <p className="text-muted-foreground">
                As informações registradas nesta etapa impactam diretamente os indicadores financeiros e
                gerenciais do Rosé. A qualidade dos dados inseridos influencia a precisão dos relatórios,
                dashboards e análises utilizadas para apoiar as decisões da empresa.
              </p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma venda ainda.</TableCell></TableRow>
              )}
              {pageItems.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{dateBR(s.sold_at)}</TableCell>
                  <TableCell className="font-medium">{s.customers?.name ?? s.customer_name ?? "Balcão"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      s.channel === "atacado" ? "bg-gold/15 text-gold-foreground"
                      : s.channel === "recursos_financeiros" ? "bg-primary/15 text-primary"
                      : "bg-accent text-accent-foreground"
                    }`}>
                      {CHANNEL_LABEL[s.channel] ?? s.channel}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {s.channel === "recursos_financeiros"
                      ? <span className="italic">Aporte financeiro</span>
                      : ((s.sale_items ?? []).map((i: any) => `${i.quantity}× ${i.products?.name}`).join(", ") || "—")}
                  </TableCell>
                  <TableCell className="text-sm">{STATUS_LABEL[s.status] ?? s.status}</TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(s.total))}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewingId(s.id)} title="Visualizar"><Eye className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(s.id)} title="Editar"><Pencil className="size-4" /></Button>
                    </div>
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

type Product = { id: string; name: string; sku: string | null; sale_price: number; wholesale_price: number; cost_price: number; stock: number };
type LineItem = { product_id: string; quantity: number; unit_price: number; unit_cost: number; name: string; max: number };

function SaleView({ saleId }: { saleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sale-detail", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(name), bank_accounts(name,bank), sale_items(quantity,unit_price,products(name))")
        .eq("id", saleId).single();
      if (error) throw error;
      return data as any;
    },
  });
  if (isLoading || !data) return <div className="py-6 text-center text-muted-foreground">Carregando…</div>;
  const items = data.sale_items ?? [];
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-muted-foreground text-xs">Cliente</div><div className="font-medium">{data.customers?.name ?? data.customer_name ?? "Balcão"}</div></div>
        <div><div className="text-muted-foreground text-xs">Data</div><div>{dateBR(data.sold_at)}</div></div>
        <div><div className="text-muted-foreground text-xs">Canal</div><div>{CHANNEL_LABEL[data.channel] ?? data.channel}</div></div>
        <div><div className="text-muted-foreground text-xs">Status</div><div>{STATUS_LABEL[data.status] ?? data.status}</div></div>
        <div><div className="text-muted-foreground text-xs">Pagamento</div><div>{PM_LABEL[data.payment_method] ?? data.payment_method}</div></div>
        <div><div className="text-muted-foreground text-xs">Conta destino</div><div>{data.bank_accounts?.name ?? "—"}</div></div>
      </div>
      <div className="rounded-lg border divide-y">
        {items.map((it: any, idx: number) => (
          <div key={idx} className="p-2 flex justify-between">
            <div>{it.quantity}× {it.products?.name}</div>
            <div className="text-muted-foreground">{brl(Number(it.unit_price) * Number(it.quantity))}</div>
          </div>
        ))}
      </div>
      <div className="text-right space-y-1">
        <div className="text-xs text-muted-foreground">Subtotal: {brl(subtotal)}</div>
        <div className="text-xs text-muted-foreground">Desconto: {brl(Number(data.discount ?? 0))}</div>
        <div className="font-display text-2xl">Total: {brl(Number(data.total))}</div>
      </div>
    </div>
  );
}

function SaleForm({ onDone, saleId }: { onDone: () => void; saleId?: string }) {
  const editing = !!saleId;

  const { data: products } = useQuery({
    queryKey: ["products-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,sale_price,wholesale_price,cost_price,stock")
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
      return data as { id: string; name: string; customer_type: "varejo" | "atacado" | "recursos_financeiros" }[];
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["sale-edit", saleId],
    enabled: editing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(product_id,quantity,unit_price,unit_cost,products(name,stock))")
        .eq("id", saleId!).single();
      if (error) throw error;
      return data as any;
    },
  });

  const [customerId, setCustomerId] = useState<string>("");
  const [walkInName, setWalkInName] = useState("");
  const [channel, setChannel] = useState<"varejo" | "atacado" | "recursos_financeiros">("varejo");
  const [status, setStatus] = useState<typeof STATUSES[number]>("confirmado");
  const [method, setMethod] = useState("dinheiro");
  const [discount, setDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<"reais" | "percent">("reais");
  const [shipping, setShipping] = useState(0);
  const [freteEmpresa, setFreteEmpresa] = useState(0);
  const [mercadoPagoFees, setMercadoPagoFees] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  // Recursos Financeiros (aporte) state
  const [aporteType, setAporteType] = useState<string>("investidor");
  const [aporteAmount, setAporteAmount] = useState<number>(0);
  const [aporteNotes, setAporteNotes] = useState<string>("");
  const [aporteDate, setAporteDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const isAporte = channel === "recursos_financeiros";

  const filteredCustomers = useMemo(
    () => (customers ?? []).filter(c =>
      isAporte ? c.customer_type === "recursos_financeiros" : c.customer_type !== "recursos_financeiros"
    ),
    [customers, isAporte]
  );

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

  const currentRule = useMemo(() => (rules ?? []).find(r => r.payment_method === method), [rules, method]);
  const locked = !!currentRule?.fixo && !!currentRule?.bank_account_id;
  const accountName = (id: string) => (bankAccounts ?? []).find(b => b.id === id)?.name ?? "";

  // Hydrate from existing sale once
  useEffect(() => {
    if (!editing || !existing || loaded) return;
    setCustomerId(existing.customer_id ?? "");
    setWalkInName(existing.customer_name ?? "");
    setChannel(existing.channel);
    setStatus(existing.status);
    setMethod(existing.payment_method);
    setDiscount(Number(existing.discount ?? 0));
    setDiscountMode("reais");
    setBankAccountId(existing.bank_account_id ?? "");
    if (existing.channel === "recursos_financeiros") {
      setAporteType(existing.aporte_type ?? "investidor");
      setAporteAmount(Number(existing.total ?? 0));
      setAporteNotes(existing.notes ?? "");
      setAporteDate((existing.sold_at ?? new Date().toISOString()).slice(0, 10));
    }
    const hydratedItems = (existing.sale_items ?? []).map((it: any) => ({
      product_id: it.product_id,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      unit_cost: Number(it.unit_cost ?? 0),
      name: it.products?.name ?? "",
      max: Number(it.products?.stock ?? 0) + Number(it.quantity),
    }));
    setItems(hydratedItems);
    const sub = hydratedItems.reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
    const fees = Number(existing.mercado_pago_fees ?? 0);
    const inferredShipping = Math.max(0, Number(existing.total ?? 0) - sub + Number(existing.discount ?? 0) - fees);
    setShipping(inferredShipping);
    setFreteEmpresa(Number(existing.frete_empresa ?? 0));
    setMercadoPagoFees(fees);
    setLoaded(true);
  }, [editing, existing, loaded]);

  useEffect(() => {
    if (editing && !loaded) return;
    if (locked) setBankAccountId(currentRule!.bank_account_id!);
  }, [locked, currentRule, editing, loaded]);

  const priceFor = (p: Product) =>
    channel === "atacado" && Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.sale_price);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const discountValue = useMemo(
    () => discountMode === "percent" ? (subtotal * Math.min(100, Math.max(0, discount))) / 100 : discount,
    [discountMode, discount, subtotal]
  );
  const total = useMemo(() => Math.max(0, subtotal - discountValue + (Number(shipping) || 0) + (Number(mercadoPagoFees) || 0)), [subtotal, discountValue, shipping, mercadoPagoFees]);

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers?.find(x => x.id === id);
    if (c && c.customer_type !== "recursos_financeiros") setChannel(c.customer_type);
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

  function changeChannel(c: "varejo" | "atacado" | "recursos_financeiros") {
    setChannel(c);
    if (c === "recursos_financeiros") {
      // clear product/sale state — aporte uses its own fields
      setItems([]);
      setDiscount(0);
      setShipping(0);
      setMercadoPagoFees(0);
      setCustomerId("");
      setWalkInName("");
      setMethod("deposito");
      return;
    }
    setItems(items.map(i => {
      const p = products?.find(x => x.id === i.product_id);
      return p ? { ...i, unit_price: c === "atacado" && Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : Number(p.sale_price) } : i;
    }));
  }

  const submit = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const selected = customers?.find(c => c.id === customerId);

      if (isAporte) {
        if (!customerId) throw new Error("Selecione o investidor / origem do aporte");
        if (!aporteAmount || aporteAmount <= 0) throw new Error("Informe o valor do aporte");
        if (!bankAccountId) throw new Error("Selecione a conta de destino");
        const payload = {
          customer_id: customerId,
          customer_name: selected?.name ?? null,
          channel: "recursos_financeiros",
          status: "entregue",
          payment_method: "deposito",
          total: aporteAmount,
          discount: 0,
          mercado_pago_fees: 0,
          bank_account_id: bankAccountId,
          aporte_type: aporteType,
          notes: aporteNotes || null,
          sold_at: new Date(aporteDate + "T12:00:00").toISOString(),
        };
        if (editing) {
          const { error: delErr } = await supabase.from("sale_items").delete().eq("sale_id", saleId!);
          if (delErr) throw delErr;
          const { error: updErr } = await supabase.from("sales").update(payload as any).eq("id", saleId!);
          if (updErr) throw updErr;
        } else {
          const { error } = await supabase.from("sales").insert({ user_id: user.id, ...payload } as any);
          if (error) throw error;
        }
        return;
      }

      if (items.length === 0) throw new Error("Adicione ao menos um produto");
      const payload = {
        customer_id: customerId || null,
        customer_name: selected?.name ?? (walkInName || null),
        channel, status, payment_method: method, total, discount: discountValue,
        mercado_pago_fees: Number(mercadoPagoFees) || 0,
        frete_empresa: Number(freteEmpresa) || 0,
        bank_account_id: bankAccountId || null,
      };

      if (editing) {
        // Replace items: delete (trigger restores stock), then insert (trigger decrements)
        const { error: delErr } = await supabase.from("sale_items").delete().eq("sale_id", saleId!);
        if (delErr) throw delErr;
        const { error: updErr } = await supabase.from("sales").update(payload as any).eq("id", saleId!);
        if (updErr) throw updErr;
        const rows = items.map(i => ({
          sale_id: saleId!, user_id: user.id, product_id: i.product_id,
          quantity: i.quantity, unit_price: i.unit_price, unit_cost: i.unit_cost,
        }));
        const { error: e2 } = await supabase.from("sale_items").insert(rows as any);
        if (e2) throw e2;
      } else {
        const { data: sale, error } = await supabase
          .from("sales")
          .insert({ user_id: user.id, ...payload } as any)
          .select().single();
        if (error) throw error;
        const rows = items.map(i => ({
          sale_id: sale.id, user_id: user.id, product_id: i.product_id,
          quantity: i.quantity, unit_price: i.unit_price, unit_cost: i.unit_cost,
        }));
        const { error: e2 } = await supabase.from("sale_items").insert(rows as any);
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success(editing ? "Venda atualizada" : "Venda registrada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (editing && !loaded) return <div className="py-8 text-center text-muted-foreground">Carregando venda…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Canal</Label>
          <Select value={channel} onValueChange={(v: any) => changeChannel(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="varejo">Varejo</SelectItem>
              <SelectItem value="atacado">Atacado</SelectItem>
              <SelectItem value="recursos_financeiros">Recursos Financeiros</SelectItem>
            </SelectContent>
          </Select>
          {isAporte && (
            <div className="text-xs text-muted-foreground">
              Aporte/investimento — não conta como venda, não afeta estoque nem Curva ABC.
            </div>
          )}
        </div>

        <div className={isAporte ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
          <Label>{isAporte ? "Investidor / origem do aporte" : "Cliente cadastrado"}</Label>
          <Select value={customerId} onValueChange={pickCustomer}>
            <SelectTrigger><SelectValue placeholder={isAporte ? "Selecionar investidor…" : "Selecionar…"} /></SelectTrigger>
            <SelectContent>
              {filteredCustomers.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {isAporte ? "Nenhum cliente com canal Recursos Financeiros." : "Sem clientes cadastrados."}
                </div>
              )}
              {filteredCustomers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name} <span className="text-muted-foreground">· {CHANNEL_LABEL[c.customer_type] ?? c.customer_type}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isAporte && (
          <div className="space-y-1.5">
            <Label>Ou nome (balcão)</Label>
            <Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} disabled={!!customerId} placeholder="Ex: Maria" />
          </div>
        )}

        {isAporte ? (
          <>
            <div className="space-y-1.5">
              <Label>Valor do aporte (R$)</Label>
              <Input type="number" step="0.01" min={0} value={aporteAmount}
                onChange={(e) => setAporteAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de recurso</Label>
              <Select value={aporteType} onValueChange={setAporteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APORTE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={aporteDate} onChange={(e) => setAporteDate(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Input value={aporteNotes} onChange={(e) => setAporteNotes(e.target.value)} placeholder="Condições, prazo, etc." />
            </div>
          </>
        ) : (
          <>
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
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="col-span-2 space-y-1.5">
          <Label>Conta de destino {locked && !isAporte && <span className="text-xs text-muted-foreground">(automático)</span>}</Label>
          {locked && !isAporte ? (
            <Input value={accountName(bankAccountId)} disabled className="bg-muted" />
          ) : (
            <Select value={bankAccountId || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {!isAporte && <SelectItem value="__none__">Não vincular a uma conta</SelectItem>}
                {(bankAccounts ?? []).map(b => (
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
            {isAporte
              ? "Conta onde o aporte foi creditado."
              : (locked ? "Esta forma de pagamento cai automaticamente nesta conta." : "A entrada será lançada nesta conta ao confirmar o recebimento.")}
          </div>
        </div>
      </div>

      {!isAporte && (
        <>
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
              <div className="flex items-center justify-between">
                <Label>Desconto</Label>
                <div className="inline-flex rounded-md border overflow-hidden text-xs">
                  <button type="button" onClick={() => setDiscountMode("reais")}
                    className={`px-2 py-1 ${discountMode === "reais" ? "bg-primary text-primary-foreground" : "bg-background"}`}>R$</button>
                  <button type="button" onClick={() => setDiscountMode("percent")}
                    className={`px-2 py-1 ${discountMode === "percent" ? "bg-primary text-primary-foreground" : "bg-background"}`}>%</button>
                </div>
              </div>
              <Input type="number" step="0.01" min={0} max={discountMode === "percent" ? 100 : undefined}
                value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              <div className="text-xs text-muted-foreground">Desconto: {brl(discountValue)}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Frete cobrado do cliente (R$)</Label>
              <Input type="number" step="0.01" min={0}
                value={shipping} onChange={(e) => setShipping(Number(e.target.value))} />
              <div className="text-xs text-muted-foreground">Valor do frete pago pelo cliente</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Juros Mercado Pago (R$)</Label>
              <Input type="number" step="0.01" min={0}
                value={mercadoPagoFees} onChange={(e) => setMercadoPagoFees(Number(e.target.value))} />
              <div className="text-xs text-muted-foreground">Soma ao total da venda</div>
            </div>
            <div className="space-y-1.5">
              <Label>Frete Empresa (R$)</Label>
              <Input type="number" step="0.01" min={0}
                value={freteEmpresa} onChange={(e) => setFreteEmpresa(Number(e.target.value))} />
              <div className="text-xs text-muted-foreground">Custo de envio pago aos Correios — não soma no total</div>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-1 text-right">
            <div className="text-xs text-muted-foreground flex justify-between"><span>Subtotal produtos</span><span>{brl(subtotal)}</span></div>
            <div className="text-xs text-muted-foreground flex justify-between"><span>Desconto</span><span>-{brl(discountValue)}</span></div>
            <div className="text-xs text-muted-foreground flex justify-between"><span>Frete cliente</span><span>+{brl(Number(shipping) || 0)}</span></div>
            <div className="text-xs text-muted-foreground flex justify-between"><span>Juros Mercado Pago</span><span>+{brl(Number(mercadoPagoFees) || 0)}</span></div>
            <div className="border-t pt-1 flex items-end justify-between">
              <span className="text-xs text-muted-foreground">TOTAL</span>
              <span className="font-display text-3xl">{brl(total)}</span>
            </div>
          </div>
        </>
      )}

      {isAporte && (
        <div className="rounded-md border p-3 text-right">
          <div className="text-xs text-muted-foreground">VALOR DO APORTE</div>
          <div className="font-display text-3xl">{brl(Number(aporteAmount) || 0)}</div>
        </div>
      )}

      <Button onClick={() => submit.mutate()}
        disabled={submit.isPending || (isAporte ? (!customerId || !aporteAmount || !bankAccountId) : items.length === 0)}
        className="w-full bg-gradient-primary text-primary-foreground">
        {submit.isPending ? "Salvando…" : (editing ? "Salvar alterações" : (isAporte ? "Registrar aporte" : "Registrar venda"))}
      </Button>
    </div>
  );
}
