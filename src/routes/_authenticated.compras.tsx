import { useMultiempresa } from '@/hooks/use-multiempresa';
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
import { useConfirm } from "@/components/confirm-dialog";
import { brl, dateBR } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Eye, ShoppingCart, HelpCircle, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({ meta: [{ title: "Compras de Mercadorias — Vejamais" }] }),
  component: ComprasPage,
});

type Compra = {
  id: string;
  fornecedor_id: string | null;
  data_compra: string;
  numero_nf: string | null;
  condicao_pagamento: string;
  forma_pagamento: string | null;
  bank_account_id: string | null;
  parcelas: number;
  dia_vencimento: number | null;
  data_vencimento: string | null;
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  observacoes: string | null;
  status: string;
  updated_at?: string;
};

type Item = { produto_id: string; quantidade: number; preco_unitario: number; subtotal: number };

function ComprasPage() {
  const { user } = useAuth();
  const { empresaId, isEnabled } = useMultiempresa();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [openNova, setOpenNova] = useState(false);
  const [editCompra, setEditCompra] = useState<Compra | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [verCompra, setVerCompra] = useState<Compra | null>(null);
  const [fFornecedor, setFFornecedor] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const { data: compras = [] } = useQuery({
    queryKey: ["compras", empresaId],
    queryFn: async () => {
      let q = supabase.from("compras").select("*");
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("data_compra", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Compra[];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores_simple", empresaId],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("id,name");
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      return (await q.order("name")).data ?? [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_simple", empresaId],
    queryFn: async () => {
      let q = supabase.from("products").select("id,name,sku,cost_price,stock");
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      return (await q.order("name")).data ?? [];
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["bank_accounts_simple_compras", empresaId],
    queryFn: async () => {
      let q = supabase.from("bank_accounts").select("id,name").eq("status", "ativa");
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      return (await q).data ?? [];
    },
  });

  const { data: payables = [] } = useQuery({
    queryKey: ["payables_compras_link", empresaId],
    queryFn: async () => {
      let q = supabase.from("payables").select("id,description,amount,paid_amount,status,due_date,bank_account_id,supplier_id,payment_method");
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      return (await q.order("due_date")).data ?? [];
    },
  });

  const fornName = (id: string | null) => fornecedores.find((f: any) => f.id === id)?.name ?? "—";

  const compraPayables = (c: Compra) => payables.filter((p: any) => p.description?.includes(`#${c.id.slice(0, 8)}`));

  const compraStatus = (c: Compra): "pago" | "pendente" | "atrasado" | "parcial" | "cancelado" => {
    if (c.status === "cancelada") return "cancelado";
    const ps = compraPayables(c);
    if (ps.length === 0) return "pendente";
    const pagas = ps.filter((p: any) => p.status === "pago").length;
    const atrasada = ps.some((p: any) => p.status === "atrasado");
    if (pagas === ps.length) return "pago";
    if (atrasada) return "atrasado";
    if (pagas > 0) return "parcial";
    return "pendente";
  };

  const comprasFiltradas = useMemo(() => compras.filter((c) => {
    if (fFornecedor !== "todos" && c.fornecedor_id !== fFornecedor) return false;
    if (fDe && c.data_compra < fDe) return false;
    if (fAte && c.data_compra > fAte) return false;
    if (fStatus !== "todos" && compraStatus(c) !== fStatus) return false;
    return true;
  }), [compras, fFornecedor, fStatus, fDe, fAte, payables]);

  // Resumo do mês
  const hoje = new Date();
  const mesIni = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const totalMes = compras.filter((c) => c.data_compra >= mesIni && c.status !== "cancelada").reduce((s, c) => s + Number(c.total), 0);
  const pagoMes = payables.filter((p: any) => p.status === "pago" && p.description?.includes("Compra #") && (p as any).due_date >= mesIni).reduce((s: number, p: any) => s + Number(p.paid_amount || 0), 0);
  const pendenteTot = payables.filter((p: any) => p.status === "pendente" && p.description?.includes("Compra #")).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const fornAtivos = new Set(compras.filter((c) => c.data_compra >= mesIni && c.status !== "cancelada").map((c) => c.fornecedor_id).filter(Boolean)).size;

  const cancelar = useMutation({
    mutationFn: async (c: Compra) => {
      // Buscar itens para estornar estoque
      const { data: itens } = await (supabase.from("compras_itens" as any).select("*").eq("compra_id", c.id));
      for (const it of (itens ?? []) as any[]) {
        const { data: prod } = await supabase.from("products").select("stock").eq("id", it.produto_id).single();
        if (prod) {
          await supabase.from("products").update({ stock: Number(prod.stock) - Number(it.quantidade) }).eq("id", it.produto_id);
        }
      }
      // Cancelar payables vinculadas (não pagas)
      await supabase.from("payables").update({ status: "cancelado" }).ilike("description", `%#${c.id.slice(0, 8)}%`).neq("status", "pago");
      // Marcar compra cancelada
      await (supabase.from("compras" as any).update({ status: "cancelada" }).eq("id", c.id));
    },
    onSuccess: () => {
      toast.success("Compra cancelada, estoque estornado");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["payables_compras_link"] });
      qc.invalidateQueries({ queryKey: ["produtos_simple"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onCancelar = async (c: Compra) => {
    const ok = await confirm({
      title: "Cancelar compra?",
      description: "Estoque será estornado e parcelas pendentes serão canceladas.",
      confirmText: "Cancelar compra",
    });
    if (ok) cancelar.mutate(c);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Compras de Mercadorias" subtitle="Registre compras e gere automaticamente contas a pagar e entradas de estoque" action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowHelp(true)}>
            <HelpCircle className="size-4 mr-1" /> Como funciona esta etapa
          </Button>
          <Dialog open={openNova} onOpenChange={setOpenNova}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Nova compra</Button></DialogTrigger>
            {openNova && (
              <NovaCompraDialog
                userId={user?.id ?? ""}
                empresaId={isEnabled ? empresaId : undefined}
                fornecedores={fornecedores as any}
                produtos={produtos as any}
                contas={contas as any}
                onDone={() => { setOpenNova(false); qc.invalidateQueries({ queryKey: ["compras"] }); qc.invalidateQueries({ queryKey: ["payables_compras_link"] }); qc.invalidateQueries({ queryKey: ["produtos_simple"] }); }}
              />
            )}
          </Dialog>
        </div>
      } />

      {/* Resumo */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Comprado no mês</div><div className="text-2xl font-display mt-1">{brl(totalMes)}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Pago no mês</div><div className="text-2xl font-display mt-1 text-success">{brl(pagoMes)}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Pendente total</div><div className="text-2xl font-display mt-1 text-destructive">{brl(pendenteTot)}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Fornecedores no mês</div><div className="text-2xl font-display mt-1">{fornAtivos}</div></CardContent></Card>
      </div>

      {/* Filtros */}
      <Card className="shadow-soft mb-4"><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">De</Label><Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} /></div>
        <div><Label className="text-xs">Fornecedor</Label>
          <Select value={fFornecedor} onValueChange={setFFornecedor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {fornecedores.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card className="shadow-soft"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>NF/Pedido</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Condição</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {comprasFiltradas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma compra registrada.</TableCell></TableRow>}
            {comprasFiltradas.map((c) => {
              const st = compraStatus(c);
              return (
                <TableRow key={c.id}>
                  <TableCell>{dateBR(c.data_compra)}</TableCell>
                  <TableCell>{fornName(c.fornecedor_id)}</TableCell>
                  <TableCell>{c.numero_nf ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{brl(Number(c.total))}</TableCell>
                  <TableCell className="capitalize">{c.condicao_pagamento.replace("_", " ")}{c.parcelas > 1 ? ` (${c.parcelas}x)` : ""}</TableCell>
                  <TableCell>
                    {st === "pago" && <Badge className="bg-success">🟢 Pago</Badge>}
                    {st === "pendente" && <Badge className="bg-amber-500 text-white">🟡 Pendente</Badge>}
                    {st === "atrasado" && <Badge variant="destructive">🔴 Atrasado</Badge>}
                    {st === "parcial" && <Badge className="bg-blue-500 text-white">🔵 Parcial</Badge>}
                    {st === "cancelado" && <Badge variant="outline">Cancelado</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setVerCompra(c)} title="Visualizar" aria-label="Visualizar compra"><Eye className="size-4" /></Button>
                    {st !== "cancelado" && (() => {
                      const ps = compraPayables(c);
                      const elegivel =
                        c.status === "confirmada" &&
                        ps.length > 0 &&
                        ps.length === (c.parcelas || 1) &&
                        ps.every((p: any) =>
                          p.status === "pendente" &&
                          Number(p.paid_amount || 0) === 0 &&
                          !p.bank_account_id
                        );
                      const tip = elegivel
                        ? "Editar compra"
                        : "Esta compra não pode ser editada porque possui pagamento, movimentação financeira ou status incompatível.";
                      return (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!elegivel}
                          onClick={() => elegivel && setEditCompra(c)}
                          title={tip}
                          aria-label="Editar compra"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      );
                    })()}

                    {st !== "cancelado" && (
                      <Button size="icon" variant="ghost" onClick={() => onCancelar(c)} title="Cancelar compra" aria-label="Cancelar compra"><Trash2 className="size-4 text-destructive" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!verCompra} onOpenChange={(o) => !o && setVerCompra(null)}>
        {verCompra && <DetalheCompra compra={verCompra} fornName={fornName(verCompra.fornecedor_id)} payables={compraPayables(verCompra)} />}
      </Dialog>

      <Dialog open={!!editCompra} onOpenChange={(o) => !o && setEditCompra(null)}>
        {editCompra && (
          <NovaCompraDialog
            key={`edit-${editCompra.id}`}
            mode="edit"
            editCompra={editCompra}
            userId={user?.id ?? ""}
            empresaId={isEnabled ? empresaId : undefined}
            fornecedores={fornecedores as any}
            produtos={produtos as any}
            contas={contas as any}
            onDone={() => {
              setEditCompra(null);
              qc.invalidateQueries({ queryKey: ["compras"] });
              qc.invalidateQueries({ queryKey: ["payables_compras_link"] });
              qc.invalidateQueries({ queryKey: ["produtos_simple"] });
              qc.invalidateQueries({ queryKey: ["compra_itens", editCompra.id] });
            }}
          />
        )}
      </Dialog>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📖 Compras de Mercadorias — Registro, Estoque e Contas a Pagar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h4 className="font-semibold mb-1">📌 Objetivo desta etapa</h4>
              <p className="text-muted-foreground">O módulo Compras de Mercadorias é responsável por registrar as compras feitas junto aos fornecedores, controlar os valores comprados, gerar automaticamente contas a pagar quando aplicável e atualizar as entradas de estoque dos produtos adquiridos.</p>
            </section>
            <section>
              <h4 className="font-semibold mb-1">🛠️ O que pode ser feito</h4>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Registrar novas compras de mercadorias</li>
                <li>Informar fornecedor, data, número da nota fiscal ou pedido</li>
                <li>Informar os produtos comprados</li>
                <li>Registrar quantidade, custo e valor total</li>
                <li>Definir condição de pagamento</li>
                <li>Acompanhar compras pagas, pendentes ou parceladas</li>
                <li>Consultar compras por período, fornecedor e status</li>
                <li>Apoiar o controle financeiro e o controle de estoque</li>
              </ul>
            </section>
            <section>
              <h4 className="font-semibold mb-1">🔁 Fluxo recomendado</h4>
              <ol className="list-decimal pl-5 space-y-0.5 text-muted-foreground">
                <li>Selecionar o fornecedor previamente cadastrado</li>
                <li>Informar a data da compra</li>
                <li>Preencher o número da nota fiscal ou pedido</li>
                <li>Adicionar os produtos comprados</li>
                <li>Conferir quantidades, custos e total da compra</li>
                <li>Definir a condição de pagamento: à vista, parcelado ou pendente</li>
                <li>Salvar a compra</li>
                <li>Conferir se a conta a pagar e a entrada de estoque foram geradas corretamente, quando aplicável</li>
              </ol>
            </section>
            <section>
              <h4 className="font-semibold mb-1">🎯 Objetivo do resultado</h4>
              <p className="text-muted-foreground mb-1">Registro completo da compra contendo fornecedor, data, NF/pedido, produtos, quantidades, custos, total, condição de pagamento e status. Alimenta:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Contas a Pagar</li>
                <li>Estoque</li>
                <li>Financeiro</li>
                <li>Fluxo de Caixa</li>
                <li>Relatórios e BI</li>
                <li>Indicadores de compras e fornecedores</li>
              </ul>
            </section>
            <section>
              <h4 className="font-semibold mb-1">✅ Boas práticas</h4>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Registrar somente compras reais e conferidas</li>
                <li>Manter fornecedores e produtos atualizados</li>
                <li>Conferir valores antes de salvar</li>
                <li>Evitar excluir compras já vinculadas ao financeiro ou estoque</li>
                <li>Usar filtros por período, fornecedor e status para auditoria</li>
              </ul>
            </section>
            <section>
              <h4 className="font-semibold mb-1">⚠️ Importante</h4>
              <p className="text-muted-foreground">As compras registradas impactam diretamente o estoque, contas a pagar, fluxo de caixa, despesas e indicadores financeiros. Preencha os dados com atenção para preservar a consistência dos relatórios e dashboards.</p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetalheCompra({ compra, fornName, payables }: { compra: Compra; fornName: string; payables: any[] }) {
  const { data: itens = [] } = useQuery({
    queryKey: ["compra_itens", compra.id],
    queryFn: async () => {
      const { data } = await (supabase.from("compras_itens" as any).select("*, produto:products(name,sku)").eq("compra_id", compra.id));
      return (data ?? []) as any[];
    },
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Compra — {fornName}</DialogTitle></DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><div className="text-muted-foreground">Data</div><div className="font-medium">{dateBR(compra.data_compra)}</div></div>
          <div><div className="text-muted-foreground">NF/Pedido</div><div className="font-medium">{compra.numero_nf ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Condição</div><div className="font-medium capitalize">{compra.condicao_pagamento.replace("_", " ")}</div></div>
        </div>

        <div>
          <div className="font-medium mb-2">Itens</div>
          <Table>
            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
            <TableBody>
              {itens.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.produto?.name ?? "—"} {it.produto?.sku && <span className="text-xs text-muted-foreground">({it.produto.sku})</span>}</TableCell>
                  <TableCell className="text-right">{Number(it.quantidade)}</TableCell>
                  <TableCell className="text-right">{brl(Number(it.preco_unitario))}</TableCell>
                  <TableCell className="text-right">{brl(Number(it.subtotal))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-4 gap-2 text-xs border-t pt-3">
          <div><div className="text-muted-foreground">Subtotal</div><div>{brl(Number(compra.subtotal))}</div></div>
          <div><div className="text-muted-foreground">Desconto</div><div>{brl(Number(compra.desconto))}</div></div>
          <div><div className="text-muted-foreground">Frete</div><div>{brl(Number(compra.frete))}</div></div>
          <div><div className="text-muted-foreground">Total</div><div className="font-medium">{brl(Number(compra.total))}</div></div>
        </div>

        <div>
          <div className="font-medium mb-2">Parcelas em contas a pagar</div>
          {payables.length === 0 ? <div className="text-muted-foreground text-xs">Nenhuma vinculada.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {payables.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.description}</TableCell>
                    <TableCell>{dateBR(p.due_date)}</TableCell>
                    <TableCell className="text-right">{brl(Number(p.amount))}</TableCell>
                    <TableCell><Badge variant={p.status === "pago" ? "default" : p.status === "atrasado" ? "destructive" : "outline"}>{p.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {compra.observacoes && <div className="text-xs"><span className="text-muted-foreground">Observações: </span>{compra.observacoes}</div>}
      </div>
    </DialogContent>
  );
}

function NovaCompraDialog({ userId, empresaId: passedEmpresaId, fornecedores, produtos, contas, onDone, mode = "create", editCompra }: {
  userId: string; empresaId?: string; fornecedores: { id: string; name: string }[];
  produtos: { id: string; name: string; sku: string | null; cost_price: number; stock: number }[];
  contas: { id: string; name: string }[]; onDone: () => void;
  mode?: "create" | "edit"; editCompra?: Compra;
}) {
  const { isEnabled, empresaId: contextEmpresaId } = useMultiempresa();
  const empresaId = passedEmpresaId || (isEnabled ? contextEmpresaId : undefined);
  const isEdit = mode === "edit" && !!editCompra;
  const shortIdEdit = isEdit ? editCompra!.id.slice(0, 8) : "";

  // Pilot Idempotency Logic
  const isPilotEnabled = import.meta.env.VITE_ENABLE_PURCHASE_IDEMPOTENCY_PILOT === 'true';
  const idempotencyKeyRef = useRef<string | null>(null);
  const [pilotState, setPilotState] = useState<'idle' | 'prepared' | 'submitting' | 'ambiguous_failure' | 'definitive_failure' | 'confirmed' | 'cancelled'>('idle');

  // Isolamento por empresa: se empresaId mudar, limpamos a chave do piloto
  useEffect(() => {
    idempotencyKeyRef.current = null;
    setPilotState('idle');
  }, [empresaId]);

  // Carrega itens existentes em modo edição
  const { data: existingItens } = useQuery({
    queryKey: ["compra_itens_edit", editCompra?.id],
    enabled: isEdit,
    queryFn: async () => {
      const { data } = await (supabase.from("compras_itens" as any).select("*").eq("compra_id", editCompra!.id));
      return (data ?? []) as any[];
    },
  });

  // Carrega parcelas vinculadas para revalidar elegibilidade e apagar/recriar
  const payablesQuery = useQuery({
    queryKey: ["compra_payables_edit", editCompra?.id],
    enabled: isEdit,
    queryFn: async () => {
      // Consulta ancorada (read-only): descrição inicia por "Compra #<shortId8> —".
      // Escopo por user_id da própria compra (defesa em profundidade além do RLS).
      // Ordenação: due_date ASC; desempate pelo número da parcela via sufixo "(k/n)".
      const ownerId = (editCompra as any)?.user_id ?? userId;
      let q = supabase
        .from("payables")
        .select("id,description,amount,paid_amount,status,due_date,bank_account_id,user_id")
        .like("description", `Compra #${shortIdEdit} —%`)
        .order("due_date", { ascending: true });
      if (ownerId) q = q.eq("user_id", ownerId);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });
  const existingPayables = payablesQuery.data;

  const initialForm = useMemo(() => {
    if (isEdit && editCompra) {
      const c = editCompra;
      const cond = (c.condicao_pagamento as "a_vista" | "parcelado" | "a_prazo") ?? "a_vista";
      return {
        fornecedor_id: c.fornecedor_id ?? "",
        data_compra: c.data_compra,
        numero_nf: c.numero_nf ?? "",
        condicao: cond,
        forma_pagamento: c.forma_pagamento ?? "pix",
        bank_account_id: c.bank_account_id ?? "",
        parcelas: c.parcelas > 1 ? c.parcelas : 2,
        // Em edição, começa vazio: será preenchido a partir das payables reais
        // (ordenadas por due_date ASC + nº da parcela). Não usar c.data_vencimento
        // como fallback silencioso — a fonte da verdade é a payable persistida.
        data_primeira_parcela: "",
        data_vencimento: cond === "a_prazo" ? (c.data_vencimento ?? "") : "",
        desconto: String(c.desconto ?? 0),
        frete: String(c.frete ?? 0),
        observacoes: c.observacoes ?? "",
      };
    }
    return {
      fornecedor_id: "", data_compra: new Date().toISOString().slice(0, 10), numero_nf: "",
      condicao: "a_vista" as "a_vista" | "parcelado" | "a_prazo",
      forma_pagamento: "pix", bank_account_id: "",
      parcelas: 2, data_primeira_parcela: "", data_vencimento: "",
      desconto: "0", frete: "0", observacoes: "",
    };
  }, [isEdit, editCompra]);

  const [f, setF] = useState(initialForm);

  const [itens, setItens] = useState<(Item & { _key: string })[]>([]);
  const [busca, setBusca] = useState("");
  const [itensLoaded, setItensLoaded] = useState(false);
  const [payablesLoaded, setPayablesLoaded] = useState(false);

  // Preenche itens uma única vez quando dados do modo edit chegam
  if (isEdit && existingItens && !itensLoaded) {
    setItens(existingItens.map((it: any) => ({
      _key: crypto.randomUUID(),
      produto_id: it.produto_id,
      quantidade: Math.max(1, Math.trunc(Number(it.quantidade) || 1)),
      preco_unitario: Number(it.preco_unitario) || 0,
      subtotal: Number(it.subtotal) || 0,
    })));
    setItensLoaded(true);
  }

  // Extrai índice da parcela (i em "(i/n)") para ordenação secundária determinística
  const parcelaIndex = (desc: string | null | undefined): number => {
    const m = /\((\d+)\/\d+\)\s*$/.exec(desc ?? "");
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };

  // Payables ordenadas: due_date ASC, depois nº da parcela ASC
  const sortedPayables = useMemo(() => {
    if (!existingPayables) return [];
    return [...existingPayables].sort((a, b) => {
      const da = String(a.due_date ?? "");
      const db = String(b.due_date ?? "");
      if (da !== db) return da < db ? -1 : 1;
      return parcelaIndex(a.description) - parcelaIndex(b.description);
    });
  }, [existingPayables]);

  // Preenche data da 1ª parcela reativamente, apenas após conclusão bem-sucedida
  // da query das payables. Trata YYYY-MM-DD como data civil, sem new Date()/UTC.
  useEffect(() => {
    if (mode !== "edit") return;
    if (!editCompra?.id) return;
    if (!payablesQuery.isSuccess) return;
    if (sortedPayables.length === 0) return;

    const expected = Math.max(1, Number(editCompra.parcelas) || 1);
    if (sortedPayables.length !== expected) return;

    const firstDueDate = String(sortedPayables[0].due_date ?? "").slice(0, 10);
    if (!firstDueDate) return;

    setF((current) => {
      if (current.data_primeira_parcela === firstDueDate) return current;
      return {
        ...current,
        data_primeira_parcela: firstDueDate,
      };
    });
    setPayablesLoaded(true);
  }, [mode, editCompra?.id, editCompra?.parcelas, payablesQuery.isSuccess, sortedPayables]);

  useEffect(() => {
    if (mode !== "edit") return;
    if (!editCompra?.id) return;
    if (payablesQuery.isSuccess || payablesQuery.isError) {
      setPayablesLoaded(true);
    }
  }, [mode, editCompra?.id, payablesQuery.isSuccess, payablesQuery.isError]);

  // Validações de integridade (bloqueiam Salvar em modo edit)
  const payablesMissing = isEdit && payablesLoaded && sortedPayables.length === 0;
  const expectedParcelas = isEdit && editCompra ? Math.max(1, Number(editCompra.parcelas) || 1) : 0;
  const payablesMismatch =
    isEdit && payablesLoaded && sortedPayables.length > 0 &&
    sortedPayables.length !== expectedParcelas;

  const subtotal = itens.reduce((s, it) => s + it.subtotal, 0);
  const total = Math.max(0, subtotal - (Number(f.desconto) || 0) + (Number(f.frete) || 0));

  const addItem = (prodId: string) => {
    const p = produtos.find((x) => x.id === prodId);
    if (!p) return;
    setItens((prev) => [...prev, { _key: crypto.randomUUID(), produto_id: prodId, quantidade: 1, preco_unitario: Number(p.cost_price) || 0, subtotal: Number(p.cost_price) || 0 }]);
    setBusca("");
  };

  const updateItem = (key: string, patch: Partial<Item>) => {
    setItens((prev) => prev.map((it) => {
      if (it._key !== key) return it;
      const merged = { ...it, ...patch };
      if (patch.quantidade !== undefined) {
        const q = Math.trunc(Number(patch.quantidade));
        merged.quantidade = Number.isFinite(q) && q >= 1 ? q : 1;
      }
      // Cálculo monetário em centavos inteiros para evitar imprecisão binária.
      const priceCents = Math.round(Number(merged.preco_unitario) * 100);
      merged.subtotal = (Math.max(1, Math.trunc(Number(merged.quantidade))) * priceCents) / 100;
      return merged;
    }));
  };

  const removeItem = (key: string) => setItens((prev) => prev.filter((it) => it._key !== key));

  const produtosFiltrados = busca
    ? produtos.filter((p) => p.name.toLowerCase().includes(busca.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(busca.toLowerCase())).slice(0, 8)
    : [];

  const parcelasPreview = useMemo(() => {
    if (f.condicao !== "parcelado" || !f.data_primeira_parcela || !f.parcelas) return [];
    const [y, m, d] = f.data_primeira_parcela.split("-").map(Number);
    const n = Math.max(1, Number(f.parcelas) || 1);
    // Rateio determinístico em centavos: resíduo distribuído nas primeiras parcelas.
    const totalCents = Math.round(total * 100);
    const base = Math.floor(totalCents / n);
    const resto = totalCents - base * n;
    const arr: { n: number; date: string; amount: number }[] = [];
    const pad = (v: number) => String(v).padStart(2, "0");
    for (let i = 0; i < n; i++) {
      const dv = new Date(y, m - 1 + i, 1);
      const lastDay = new Date(dv.getFullYear(), dv.getMonth() + 1, 0).getDate();
      dv.setDate(Math.min(d, lastDay));
      const dateStr = `${dv.getFullYear()}-${pad(dv.getMonth() + 1)}-${pad(dv.getDate())}`;
      const cents = base + (i < resto ? 1 : 0);
      arr.push({ n: i + 1, date: dateStr, amount: cents / 100 });
    }
    return arr;
  }, [f.condicao, f.data_primeira_parcela, f.parcelas, total]);

  const save = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Não foi possível registrar a compra. Confirme a empresa ativa e tente novamente.");
      if (!f.fornecedor_id) throw new Error("Selecione um fornecedor");
      if (itens.length === 0) throw new Error("Adicione ao menos um item");
      for (const it of itens) {
        if (!Number.isInteger(it.quantidade) || it.quantidade < 1) {
          throw new Error("Quantidade deve ser um número inteiro maior ou igual a 1");
        }
      }
      if (f.condicao === "a_vista" && !f.bank_account_id) throw new Error("Selecione a conta bancária");
      if (f.condicao === "a_prazo" && !f.data_vencimento) throw new Error("Informe a data de vencimento");
      if (f.condicao === "parcelado" && !f.data_primeira_parcela) throw new Error("Informe a data da primeira parcela");

      const fornName = fornecedores.find((x) => x.id === f.fornecedor_id)?.name ?? "Fornecedor";
      const diaVenc = f.condicao === "parcelado" ? Number(f.data_primeira_parcela.split("-")[2]) : null;

      // ============== MODO EDIT — RPC atômica ==============
      if (isEdit && editCompra) {
        if (f.condicao === "a_vista") {
          throw new Error("Não é permitido converter uma compra pendente em compra à vista nesta edição.");
        }
        const itensPayload = itens.map((it) => ({
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
        }));
        const dataPrimeira = f.condicao === "parcelado" ? f.data_primeira_parcela : f.data_vencimento;
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("rpc_editar_compra_pendente", {
          _compra_id: editCompra.id,
          _expected_updated_at: editCompra.updated_at ?? null,
          _fornecedor_id: f.fornecedor_id,
          _data_compra: f.data_compra,
          _numero_nf: f.numero_nf || null,
          _condicao: f.condicao,
          _parcelas: f.condicao === "parcelado" ? Number(f.parcelas) || 1 : 1,
          _data_primeira: dataPrimeira,
          _desconto: Number(f.desconto) || 0,
          _frete: Number(f.frete) || 0,
          _observacoes: f.observacoes || null,
          _itens: itensPayload,
        });
        if (rpcErr) {
          const map: Record<string, string> = {
            nao_autenticado: "Sessão expirada. Faça login novamente.",
            compra_nao_encontrada: "Compra não encontrada.",
            status_incompativel: "Esta compra não pode ser editada porque possui pagamento, movimentação financeira ou status incompatível.",
            conflito_atualizacao: "Esta compra foi alterada em outra operação. Atualize a página e tente novamente.",
            fornecedor_invalido: "Fornecedor inválido.",
            produto_invalido: "Produto inválido.",
            sem_itens: "Adicione ao menos um item.",
            quantidade_invalida: "Quantidade deve ser um número inteiro maior ou igual a 1.",
            preco_invalido: "Preço inválido.",
            valores_invalidos: "Desconto e frete não podem ser negativos.",
            total_negativo: "O total não pode ser negativo.",
            payables_incompativeis: "Esta compra possui pagamento ou está vinculada a uma conta bancária.",
            movimento_bancario_existente: "Esta compra possui movimentação financeira e não pode ser editada.",
            parcelas_nao_encontradas: "Não foi possível localizar as parcelas desta compra.",
            correspondencia_ambigua_ou_incompleta: "Correspondência ambígua das parcelas — edição bloqueada por segurança.",
            condicao_invalida: "Condição de pagamento inválida para edição.",
          };
          const key = (rpcErr.message || "").trim();
          throw new Error(map[key] ?? `Falha ao editar: ${rpcErr.message}`);
        }
        return { count: (rpcData as any)?.parcelas_recriadas ?? 0, edit: true };
      }

      // ============== MODO CREATE — RPC atômica (CORREÇÃO P1) ==============
      const purchasePayload = {
        fornecedor_id: f.fornecedor_id,
        data_compra: f.data_compra,
        numero_nf: f.numero_nf || null,
        condicao_pagamento: f.condicao,
        forma_pagamento: f.condicao === "a_vista" ? f.forma_pagamento : null,
        bank_account_id: f.condicao === "a_vista" ? f.bank_account_id : null,
        parcelas: f.condicao === "parcelado" ? f.parcelas : 1,
        dia_vencimento: diaVenc,
        data_vencimento: f.condicao === "a_prazo" ? f.data_vencimento : (f.condicao === "parcelado" ? f.data_primeira_parcela : null),
        subtotal,
        desconto: Number(f.desconto) || 0,
        frete: Number(f.frete) || 0,
        total,
        observacoes: f.observacoes || null,
        status: "confirmada"
      };

      const itemsPayload = itens.map((it) => ({
        produto_id: it.produto_id,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
      }));

      const payablesPayload = [];
      const baseDesc = `Compra #AUTO — ${fornName}${f.numero_nf ? ` NF ${f.numero_nf}` : ""}`;
      
      if (f.condicao === "a_vista") {
        payablesPayload.push({
          description: baseDesc.replace("#AUTO", ""), // A RPC não tem o ID ainda, mas o baseDesc é apenas informativo
          amount: total,
          due_date: f.data_compra,
          status: "pago",
          paid_amount: total,
          paid_at: new Date().toISOString(),
          bank_account_id: f.bank_account_id,
        });
      } else if (f.condicao === "parcelado") {
        parcelasPreview.forEach((p) => {
          payablesPayload.push({
            description: `${baseDesc.replace("#AUTO", "")} (${p.n}/${f.parcelas})`,
            amount: p.amount,
            due_date: p.date,
            status: "pendente",
            paid_amount: 0,
            paid_at: null,
            bank_account_id: null,
          });
        });
      } else {
        payablesPayload.push({
          description: baseDesc.replace("#AUTO", ""),
          amount: total,
          due_date: f.data_vencimento,
          status: "pendente",
          paid_amount: 0,
          paid_at: null,
          bank_account_id: null,
        });
      }

      const { data: compraId, error: rpcErr } = await (supabase.rpc as any)("rpc_registrar_compra", {
        p_empresa_id: empresaId,
        p_payload: purchasePayload,
        p_items: itemsPayload,
        p_payables: payablesPayload,
        p_idempotency_key: `compra_${empresaId}_${f.fornecedor_id}_${f.data_compra}_${subtotal}_${Date.now()}`,
      });

      if (rpcErr) {
        console.error("Erro RPC rpc_registrar_compra:", rpcErr);
        // Mapear erros conhecidos da RPC para mensagens amigáveis
        if (rpcErr.message?.includes("Cross-Tenant")) {
           throw new Error("Segurança: Tentativa de acesso a dados de outra empresa detectada.");
        }
        throw new Error("Não foi possível registrar a compra. Confirme a empresa ativa e tente novamente.");
      }

      return { count: payablesPayload.length, edit: false };
    },
    onSuccess: (r) => {
      if (r.edit) toast.success("Compra atualizada com sucesso.");
      else toast.success(`Compra registrada! ${r.count} conta(s) a pagar gerada(s) e estoque atualizado.`);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShoppingCart className="size-5" /> {isEdit ? "Editar compra" : "Nova compra"}
          {isEdit && editCompra?.numero_nf && (
            <span className="text-xs text-muted-foreground font-normal ml-2">NF/Pedido {editCompra.numero_nf}</span>
          )}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Fornecedor</Label>
            <Select value={f.fornecedor_id} onValueChange={(v) => setF({ ...f, fornecedor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{fornecedores.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data da compra</Label><Input type="date" value={f.data_compra} onChange={(e) => setF({ ...f, data_compra: e.target.value })} /></div>
          <div><Label>NF / Pedido</Label><Input value={f.numero_nf} onChange={(e) => setF({ ...f, numero_nf: e.target.value })} placeholder="opcional" /></div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div><Label>Condição</Label>
            <Select value={f.condicao} onValueChange={(v) => setF({ ...f, condicao: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a_vista">À vista</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="a_prazo">A prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.condicao === "a_vista" && <>
            <div><Label>Forma de pagamento</Label>
              <Select value={f.forma_pagamento} onValueChange={(v) => setF({ ...f, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Conta bancária</Label>
              <Select value={f.bank_account_id} onValueChange={(v) => setF({ ...f, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>}
          {f.condicao === "parcelado" && <>
            <div><Label>Nº parcelas</Label><Input type="number" min={2} max={36} value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: Number(e.target.value) })} /></div>
            <div><Label>Data de vencimento (1ª parcela)</Label><Input type="date" value={f.data_primeira_parcela} onChange={(e) => setF({ ...f, data_primeira_parcela: e.target.value })} /></div>
          </>}

          {f.condicao === "a_prazo" && (
            <div><Label>Data de vencimento</Label><Input type="date" value={f.data_vencimento} onChange={(e) => setF({ ...f, data_vencimento: e.target.value })} /></div>
          )}
        </div>

        {isEdit && payablesMissing && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível localizar as parcelas desta compra.
          </div>
        )}
        {isEdit && payablesMismatch && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            A quantidade de parcelas cadastradas não corresponde à compra.
          </div>
        )}

        {f.condicao === "parcelado" && parcelasPreview.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Prévia das parcelas</div>
            <div className="space-y-1 text-sm">
              {parcelasPreview.map((p) => (
                <div key={p.n} className="flex items-center justify-between">
                  <span>Parcela {p.n}/{f.parcelas} → {dateBR(p.date)}</span>
                  <span className="font-medium">{brl(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}


        <div className="border-t pt-3">
          <Label>Itens da compra</Label>
          <div className="relative mt-1">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto por nome ou SKU..." />
            {produtosFiltrados.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-56 overflow-auto">
                {produtosFiltrados.map((p) => (
                  <button key={p.id} type="button" onClick={() => addItem(p.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                    {p.name} {p.sku && <span className="text-xs text-muted-foreground">({p.sku})</span>} — custo {brl(Number(p.cost_price))} · estoque {p.stock}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Table className="mt-3">
            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="w-24 text-right">Qtd</TableHead><TableHead className="w-32 text-right">Custo</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {itens.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4 text-xs">Adicione produtos pela busca acima.</TableCell></TableRow>}
              {itens.map((it) => {
                const p = produtos.find((x) => x.id === it.produto_id);
                return (
                  <TableRow key={it._key}>
                    <TableCell>{p?.name ?? "—"}</TableCell>
                    <TableCell><Input className="h-8 text-right" type="number" step={1} min={1} inputMode="numeric" value={it.quantidade} onChange={(e) => updateItem(it._key, { quantidade: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })} /></TableCell>
                    <TableCell><Input className="h-8 text-right" type="number" step="0.01" value={it.preco_unitario} onChange={(e) => updateItem(it._key, { preco_unitario: Number(e.target.value) })} /></TableCell>
                    <TableCell className="text-right">{brl(it.subtotal)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(it._key)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="grid md:grid-cols-3 gap-3 border-t pt-3">
          <div><Label>Desconto (R$)</Label><Input type="number" step="0.01" value={f.desconto} onChange={(e) => setF({ ...f, desconto: e.target.value })} /></div>
          <div><Label>Frete (R$)</Label><Input type="number" step="0.01" value={f.frete} onChange={(e) => setF({ ...f, frete: e.target.value })} /></div>
          <div className="flex flex-col justify-end">
            <div className="text-xs text-muted-foreground">Subtotal: {brl(subtotal)}</div>
            <div className="text-lg font-display">Total: {brl(total)}</div>
          </div>
        </div>

        <div><Label>Observações</Label><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()} disabled={save.isPending}>Cancelar</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || payablesMissing || payablesMismatch}>
          {save.isPending ? (isEdit ? "Salvando alterações…" : "Salvando…") : (isEdit ? "Salvar alterações" : "Salvar compra")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
