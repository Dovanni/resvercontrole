import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { HelpCircle, Package, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kardex-produtos")({
  head: () => ({ meta: [{ title: "Kardex de Produtos — Vejamais" }] }),
  component: KardexProdutosPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  cost_price: number;
};

type StockMovement = {
  id: string;
  empresa_id: string;
  product_id: string;
  movement_at: string;
  direction: "entrada" | "saida" | "saldo_inicial";
  origin: string;
  quantity: number;
  unit_cost: number | null;
  balance_before: number | null;
  balance_after: number | null;
  document: string | null;
  notes: string | null;
  is_reconstructed: boolean;
};

type Period = "dia" | "mes" | "30d" | "ano" | "custom";
type AdjustmentMode = "manual" | "implantacao";

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function periodRange(period: Exclude<Period, "custom">) {
  const today = new Date();
  const end = toYmd(today);
  if (period === "dia") return { de: end, ate: end };
  if (period === "mes") return { de: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`, ate: end };
  if (period === "ano") return { de: `${today.getFullYear()}-01-01`, ate: end };
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - 29);
  return { de: toYmd(start), ate: end };
}

function formatMovementDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const ORIGIN_LABEL: Record<string, string> = {
  compra: "Compra",
  venda: "Venda",
  estorno_venda: "Estorno de venda",
  ajuste_fisico: "Ajuste físico",
  ajuste_sistema: "Ajuste do sistema",
  saldo_inicial: "Saldo inicial",
};

function KardexProdutosPage() {
  const qc = useQueryClient();
  const { empresaId, empresa } = useMultiempresa();
  const initial = periodRange("mes");
  const [period, setPeriod] = useState<Period>("mes");
  const [fDe, setFDe] = useState(initial.de);
  const [fAte, setFAte] = useState(initial.ate);
  const [productId, setProductId] = useState("todos");
  const [movementFilter, setMovementFilter] = useState("todos");
  const [openAdjust, setOpenAdjust] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [adjustMode, setAdjustMode] = useState<AdjustmentMode>("manual");
  const [adjustProduct, setAdjustProduct] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"entrada" | "saida">("entrada");
  const [adjustQuantity, setAdjustQuantity] = useState("1");
  const [inventoryCount, setInventoryCount] = useState("");
  const [adjustDocument, setAdjustDocument] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const isAdmin = empresa?.user_role === "admin";

  const { data: products = [] } = useQuery({
    queryKey: ["products-kardex", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,stock,cost_price")
        .eq("empresa_id", empresaId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["stock-movements", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stock_movements")
        .select("id,empresa_id,product_id,movement_at,direction,origin,quantity,unit_cost,balance_before,balance_after,document,notes,is_reconstructed")
        .eq("empresa_id", empresaId)
        .order("movement_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
  });

  const setQuickPeriod = (next: Exclude<Period, "custom">) => {
    const range = periodRange(next);
    setPeriod(next);
    setFDe(range.de);
    setFAte(range.ate);
  };

  const invalidRange = !!fDe && !!fAte && fDe > fAte;

  const filtered = useMemo(() => {
    if (invalidRange) return [];
    return movements.filter((m) => {
      const date = String(m.movement_at).slice(0, 10);
      if (fDe && date < fDe) return false;
      if (fAte && date > fAte) return false;
      if (productId !== "todos" && m.product_id !== productId) return false;
      if (movementFilter === "entrada" && m.direction !== "entrada") return false;
      if (movementFilter === "saida" && m.direction !== "saida") return false;
      if (["compra", "venda", "ajuste_fisico", "ajuste_sistema", "estorno_venda"].includes(movementFilter) && m.origin !== movementFilter) return false;
      return true;
    });
  }, [movements, fDe, fAte, productId, movementFilter, invalidRange]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const entries = filtered.filter((m) => m.direction === "entrada").reduce((sum, m) => sum + Number(m.quantity || 0), 0);
  const exits = filtered.filter((m) => m.direction === "saida").reduce((sum, m) => sum + Number(m.quantity || 0), 0);
  const currentStock = productId === "todos"
    ? products.reduce((sum, p) => sum + Number(p.stock || 0), 0)
    : Number(productMap.get(productId)?.stock || 0);

  const selectedAdjustProduct = productMap.get(adjustProduct);
  const countedInventory = inventoryCount === "" ? null : Number(inventoryCount);
  const inventoryDifference = selectedAdjustProduct && countedInventory != null && Number.isInteger(countedInventory) && countedInventory >= 0
    ? countedInventory - Number(selectedAdjustProduct.stock || 0)
    : null;

  const resetAdjustForm = () => {
    setAdjustMode("manual");
    setAdjustProduct("");
    setAdjustDirection("entrada");
    setAdjustQuantity("1");
    setInventoryCount("");
    setAdjustDocument("");
    setAdjustReason("");
  };

  const adjust = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa ativa não identificada.");
      if (!adjustProduct) throw new Error("Selecione o produto.");

      let direction: "entrada" | "saida" = adjustDirection;
      let quantity = Number(adjustQuantity);
      let reason = adjustReason.trim();
      let document = adjustDocument.trim() || null;

      if (adjustMode === "implantacao") {
        if (!selectedAdjustProduct) throw new Error("Produto não encontrado.");
        const counted = Number(inventoryCount);
        if (!Number.isInteger(counted) || counted < 0) throw new Error("A quantidade física contada deve ser um número inteiro igual ou maior que zero.");
        const difference = counted - Number(selectedAdjustProduct.stock || 0);
        if (difference === 0) throw new Error("O estoque informado é igual ao estoque atual. Nenhum ajuste é necessário.");
        direction = difference > 0 ? "entrada" : "saida";
        quantity = Math.abs(difference);
        reason = `Inventário de implantação: estoque do sistema ${Number(selectedAdjustProduct.stock || 0)}, contagem física ${counted}.`;
        document = document || `Inventário de implantação ${toYmd(new Date())}`;
      } else {
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("A quantidade física deve ser um número inteiro maior que zero.");
        if (!reason) throw new Error("Informe o motivo do ajuste físico.");
      }

      const { error } = await (supabase.rpc as any)("rpc_registrar_ajuste_estoque", {
        p_empresa_id: empresaId,
        p_product_id: adjustProduct,
        p_direction: direction,
        p_quantity: quantity,
        p_reason: reason,
        p_document: document,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(adjustMode === "implantacao" ? "Inventário de implantação registrado no Kardex." : "Movimentação física registrada no Kardex.");
      setOpenAdjust(false);
      resetAdjustForm();
      qc.invalidateQueries({ queryKey: ["stock-movements", empresaId] });
      qc.invalidateQueries({ queryKey: ["products-kardex", empresaId] });
      qc.invalidateQueries({ queryKey: ["products", empresaId] });
      qc.invalidateQueries({ queryKey: ["dashboard", empresaId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-[1500px] mx-auto">
      <PageHeader
        title="Kardex de Produtos"
        subtitle="Histórico físico de entradas, saídas, compras, vendas e ajustes por item"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setShowHelp(true)}>
              <HelpCircle className="size-4" /> Como funciona esta etapa
            </Button>
            {isAdmin && (
              <Dialog open={openAdjust} onOpenChange={(open) => { setOpenAdjust(open); if (!open) resetAdjustForm(); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="size-4 mr-1" /> Movimentação física</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Registrar movimentação física</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Operação</Label>
                      <Select value={adjustMode} onValueChange={(v) => { setAdjustMode(v as AdjustmentMode); setInventoryCount(""); setAdjustReason(""); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Entrada / saída manual</SelectItem>
                          <SelectItem value="implantacao">Inventário de implantação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Produto</Label>
                      <Select value={adjustProduct} onValueChange={(v) => { setAdjustProduct(v); setInventoryCount(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                        <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""} — estoque {p.stock}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {adjustMode === "manual" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Movimento</Label>
                          <Select value={adjustDirection} onValueChange={(v) => setAdjustDirection(v as "entrada" | "saida")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entrada">Entrada física</SelectItem>
                              <SelectItem value="saida">Saída física</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Quantidade</Label>
                          <Input type="number" min={1} step={1} inputMode="numeric" value={adjustQuantity} onChange={(e) => setAdjustQuantity(e.target.value)} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Estoque atual</Label>
                            <Input value={selectedAdjustProduct ? String(selectedAdjustProduct.stock) : "—"} disabled />
                          </div>
                          <div>
                            <Label>Quantidade física contada</Label>
                            <Input type="number" min={0} step={1} inputMode="numeric" value={inventoryCount} onChange={(e) => setInventoryCount(e.target.value)} placeholder="Informe a contagem" />
                          </div>
                        </div>
                        {selectedAdjustProduct && inventoryDifference != null && (
                          <div className="rounded-md border bg-muted/30 p-3 text-sm">
                            <div className="font-medium">Prévia do ajuste</div>
                            <div className="mt-1 text-muted-foreground">
                              Estoque atual: <strong>{selectedAdjustProduct.stock}</strong> → Contagem física: <strong>{countedInventory}</strong>
                            </div>
                            <div className="mt-1">
                              {inventoryDifference > 0 && <>Entrada automática de <strong>+{inventoryDifference}</strong> unidade(s).</>}
                              {inventoryDifference < 0 && <>Saída automática de <strong>{Math.abs(inventoryDifference)}</strong> unidade(s).</>}
                              {inventoryDifference === 0 && <>Nenhuma diferença encontrada. Nenhuma movimentação será necessária.</>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label>Documento / referência</Label>
                      <Input value={adjustDocument} onChange={(e) => setAdjustDocument(e.target.value)} placeholder={adjustMode === "implantacao" ? "Ex.: Inventário inicial 08/2026" : "Ex.: Inventário 08/2026, avaria, devolução"} />
                    </div>
                    {adjustMode === "manual" && (
                      <div>
                        <Label>Motivo *</Label>
                        <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Descreva o motivo da entrada ou saída física" />
                      </div>
                    )}
                    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                      {adjustMode === "implantacao"
                        ? "O ERP compara a contagem física com o estoque atual e registra somente a diferença no Kardex. Esta operação não cria compra, venda ou movimentação financeira."
                        : "Esta operação altera o estoque físico do produto e grava o antes/depois no Kardex. Somente administradores da empresa podem executá-la."}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenAdjust(false)} disabled={adjust.isPending}>Cancelar</Button>
                    <Button onClick={() => adjust.mutate()} disabled={adjust.isPending || (adjustMode === "implantacao" && inventoryDifference === 0)}>{adjust.isPending ? "Registrando…" : adjustMode === "implantacao" ? "Registrar inventário" : "Registrar movimento"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      />

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">📦 Kardex de Produtos — Controle Físico do Estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-semibold text-base mb-1">🎯 Objetivo desta etapa</h3>
              <p>O Kardex registra o histórico físico de cada produto, mostrando quando houve entrada ou saída, a origem do movimento, o documento relacionado e, quando disponível, o saldo antes e depois da operação.</p>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">📊 Como interpretar os quatro indicadores</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Estoque físico atual</strong> — soma do estoque atual dos produtos selecionados. Quando um produto é filtrado, mostra somente o saldo atual daquele item.</li>
                <li><strong>Entradas físicas no período</strong> — total de unidades que entraram fisicamente dentro do período filtrado.</li>
                <li><strong>Saídas físicas no período</strong> — total de unidades que saíram fisicamente dentro do período filtrado.</li>
                <li><strong>Movimentações no período</strong> — quantidade de registros de movimentação encontrados, e não a soma das unidades.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">🔎 Filtros e períodos</h3>
              <p>Use os atalhos Dia, Mês, 30 dias e Ano ou informe manualmente as datas De/Até. Os filtros Produto e Movimento/origem permitem analisar um item específico, somente entradas, somente saídas ou uma origem determinada.</p>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">🔄 Origens das movimentações</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Compra</strong> — gera entrada física do produto.</li>
                <li><strong>Venda</strong> — gera saída física do produto.</li>
                <li><strong>Estorno de venda</strong> — registra a reversão física correspondente.</li>
                <li><strong>Ajuste físico</strong> — movimentação manual ou inventário feito por administrador.</li>
                <li><strong>Ajuste do sistema</strong> — alteração de estoque capturada automaticamente pelo Kardex quando aplicável.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">🧮 Saldo anterior e saldo após</h3>
              <p>Nos movimentos operacionais novos, o Kardex registra o estoque imediatamente antes e depois da alteração. Exemplo: saldo anterior 24, saída física 10, saldo após 14.</p>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">🧾 Registros “Reconstruídos”</h3>
              <p>Registros identificados como <strong>Reconstruído</strong> foram recuperados de documentos históricos de compras ou outras fontes existentes antes da implantação do Kardex. Por segurança, quando não existe evidência suficiente, o ERP não inventa saldo anterior ou saldo posterior.</p>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">✍️ Entrada / saída manual</h3>
              <p>Use esta operação somente quando houver uma movimentação física que não tenha sido gerada automaticamente por compra ou venda, como avaria, devolução, perda, correção ou outra ocorrência real. Informe produto, direção, quantidade, referência e motivo. O registro fica auditado no Kardex.</p>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">📋 Inventário de implantação</h3>
              <p>Use o inventário quando a empresa já operava antes da implantação do controle físico e o estoque do sistema precisa ser reconciliado com a contagem real. Informe a quantidade física contada e o ERP registra somente a diferença necessária.</p>
              <div className="mt-2 rounded-md border bg-muted/30 p-3">
                <strong>Exemplo:</strong> estoque no sistema = 24; contagem física = 14. O Kardex registra automaticamente uma saída de 10 unidades e o saldo passa para 14.
              </div>
              <p className="mt-2">O inventário de implantação não cria compra, venda nem movimentação financeira; ele apenas reconcilia o estoque físico.</p>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Não registrar manualmente uma entrada que já veio de uma compra.</li>
                <li>Não registrar manualmente uma saída que já veio de uma venda.</li>
                <li>Utilizar motivo e documento/referência claros nos ajustes.</li>
                <li>Usar o Inventário de implantação para acertar saldos herdados do período anterior ao Kardex.</li>
                <li>Conferir sempre o saldo anterior e o saldo após antes de interpretar uma divergência.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-base mb-1">⚠️ Importante</h3>
              <p>A Movimentação física altera o estoque real do produto. Por isso, somente administradores da empresa podem executá-la. O tutorial e os filtros podem ser utilizados para consulta e conferência do histórico.</p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["dia", "mes", "30d", "ano"] as const).map((p) => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setQuickPeriod(p)}>
            {p === "dia" ? "Dia" : p === "mes" ? "Mês" : p === "30d" ? "30 dias" : "Ano"}
          </Button>
        ))}
      </div>

      <Card className="shadow-soft mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><Label className="text-xs">De</Label><Input type="date" value={fDe} onChange={(e) => { setFDe(e.target.value); setPeriod("custom"); }} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={fAte} onChange={(e) => { setFAte(e.target.value); setPeriod("custom"); }} /></div>
          <div>
            <Label className="text-xs">Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Movimento / origem</Label>
            <Select value={movementFilter} onValueChange={setMovementFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Todas as entradas</SelectItem>
                <SelectItem value="saida">Todas as saídas</SelectItem>
                <SelectItem value="compra">Compras</SelectItem>
                <SelectItem value="venda">Vendas</SelectItem>
                <SelectItem value="ajuste_fisico">Ajustes físicos</SelectItem>
                <SelectItem value="estorno_venda">Estornos de venda</SelectItem>
                <SelectItem value="ajuste_sistema">Outros ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {invalidRange && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">A data inicial não pode ser posterior à data final.</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Estoque físico atual</div><div className="text-2xl font-display mt-1">{currentStock}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Entradas físicas no período</div><div className="text-2xl font-display mt-1 text-success">{entries}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Saídas físicas no período</div><div className="text-2xl font-display mt-1 text-destructive">{exits}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Movimentações no período</div><div className="text-2xl font-display mt-1">{filtered.length}</div></CardContent></Card>
      </div>

      <div className="mb-4 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong>Fase segura:</strong> o Kardex registra as novas alterações sem substituir o saldo operacional de <code>products.stock</code>. Registros marcados como “Reconstruído” foram recuperados de documentos históricos; por segurança, seus saldos anterior e posterior não são inventados.
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Entrada física</TableHead>
                <TableHead className="text-right">Saída física</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead className="text-right">Saldo anterior</TableHead>
                <TableHead className="text-right">Saldo após</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Nenhuma movimentação encontrada para os filtros selecionados.</TableCell></TableRow>}
              {isLoading && <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Carregando Kardex…</TableCell></TableRow>}
              {filtered.map((m) => {
                const product = productMap.get(m.product_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{formatMovementDate(m.movement_at)}</TableCell>
                    <TableCell className="min-w-[180px]"><div className="font-medium">{product?.name ?? "Produto"}</div>{product?.sku && <div className="text-xs text-muted-foreground">SKU {product.sku}</div>}</TableCell>
                    <TableCell><div className="flex items-center gap-2"><span>{ORIGIN_LABEL[m.origin] ?? m.origin}</span>{m.is_reconstructed && <Badge variant="outline">Reconstruído</Badge>}</div></TableCell>
                    <TableCell>{m.document ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{m.direction === "entrada" ? Number(m.quantity) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{m.direction === "saida" ? Number(m.quantity) : "—"}</TableCell>
                    <TableCell className="text-right">{m.unit_cost == null ? "—" : brl(Number(m.unit_cost))}</TableCell>
                    <TableCell className="text-right">{m.balance_before == null ? "—" : Number(m.balance_before)}</TableCell>
                    <TableCell className="text-right">{m.balance_after == null ? "—" : Number(m.balance_after)}</TableCell>
                    <TableCell className="max-w-[260px] text-xs text-muted-foreground">{m.notes ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2"><Package className="size-4" /> Compras geram entrada física; vendas geram saída física; ajustes manuais exigem motivo e ficam auditados.</div>
    </div>
  );
}
