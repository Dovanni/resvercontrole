import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, FileText, AlertTriangle, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

type Props = {
  saleId: string | null;
  onClose: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento", confirmado: "Confirmado", separacao: "Separação",
  enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado",
};

const PAGTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", pix_prazo: "PIX a prazo", debito: "Débito",
  cartao_debito: "Cartão Débito", cartao_credito: "Cartão Crédito", cartao: "Cartão",
  mercado_livre: "Mercado Livre", boleto: "Boleto", crediario: "Crediário",
  prazo: "A prazo", deposito: "Depósito", transferencia: "Transferência",
};

export function AuditoriaLucroDialog({ saleId, onClose }: Props) {
  const open = !!saleId;

  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["auditoria-lucro", saleId],
    queryFn: async () => {
      if (!saleId) return null;

      const { data: sale, error: sErr } = await supabase
        .from("sales")
        .select("id, sold_at, customer_name, channel, payment_method, total, discount, status, mercado_pago_fees, frete_empresa, notes, user_id, customers(name), sale_items(id, quantity, unit_price, unit_cost, product_id, products(id, name, sku, cost_price, brand, category))")
        .eq("id", saleId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!sale) return null;

      const { data: cvd } = await supabase
        .from("controle_vendas_diario")
        .select("*")
        .eq("sale_id", saleId)
        .maybeSingle();

      const productIds = (sale.sale_items ?? []).map((it: any) => it.product_id).filter(Boolean);
      let compraRows: any[] = [];
      if (productIds.length > 0) {
        const { data: cItens } = await supabase
          .from("compras_itens")
          .select("id, produto_id, quantidade, preco_unitario, compra_id, compras(id, data_compra, numero_nf, subtotal, desconto, fornecedor_id, suppliers(name, delivery_days, payment_terms))")
          .eq("user_id", sale.user_id)
          .in("produto_id", productIds);
        compraRows = cItens ?? [];
      }

      // aggregate net cost per product (matches sync_cvd_from_sale)
      const byProd: Record<string, any[]> = {};
      compraRows.forEach((r) => {
        (byProd[r.produto_id] ||= []).push(r);
      });

      const items = (sale.sale_items ?? []).map((it: any) => {
        const rows = byProd[it.product_id] ?? [];
        let sumQ = 0, sumWeighted = 0;
        rows.forEach((r) => {
          const sub = Number(r.compras?.subtotal ?? 0);
          const desc = Number(r.compras?.desconto ?? 0);
          const factor = sub > 0 ? Math.max(1 - desc / sub, 0) : 1;
          const q = Number(r.quantidade ?? 0);
          sumQ += q;
          sumWeighted += q * Number(r.preco_unitario ?? 0) * factor;
        });
        const netCost = sumQ > 0 ? sumWeighted / sumQ : Number(it.unit_cost ?? 0);
        // pick latest compra as "última compra usada"
        const sortedRows = [...rows].sort((a, b) =>
          String(b.compras?.data_compra ?? "").localeCompare(String(a.compras?.data_compra ?? "")));
        const last = sortedRows[0];
        const lastSub = Number(last?.compras?.subtotal ?? 0);
        const lastDesc = Number(last?.compras?.desconto ?? 0);
        const lastPct = lastSub > 0 ? (lastDesc / lastSub) * 100 : 0;
        const grossCost = Number(it.unit_cost ?? it.products?.cost_price ?? 0);
        return {
          id: it.id,
          product_id: it.product_id,
          name: it.products?.name ?? "—",
          sku: it.products?.sku ?? "—",
          brand: it.products?.brand ?? "—",
          category: it.products?.category ?? "—",
          quantity: Number(it.quantity ?? 0),
          unit_price: Number(it.unit_price ?? 0),
          total_price: Number(it.quantity ?? 0) * Number(it.unit_price ?? 0),
          gross_cost: grossCost,
          net_cost: netCost,
          discount_value: Math.max(grossCost - netCost, 0),
          discount_pct: grossCost > 0 ? Math.max((1 - netCost / grossCost) * 100, 0) : 0,
          total_cost: netCost * Number(it.quantity ?? 0),
          supplier: last?.compras?.suppliers?.name ?? null,
          supplier_delivery_days: last?.compras?.suppliers?.delivery_days ?? null,
          supplier_payment_terms: last?.compras?.suppliers?.payment_terms ?? null,
          last_purchase_date: last?.compras?.data_compra ?? null,
          last_purchase_nf: last?.compras?.numero_nf ?? null,
          last_compra_id: last?.compras?.id ?? null,
          last_item_id: last?.id ?? null,
          last_pct: lastPct,
          last_gross_price: Number(last?.preco_unitario ?? 0),
          last_net_price: Number(last?.preco_unitario ?? 0) * Math.max(1 - lastPct / 100, 0),
          purchases: rows.map((r) => ({
            compra_id: r.compras?.id,
            item_id: r.id,
            date: r.compras?.data_compra,
            nf: r.compras?.numero_nf,
            supplier: r.compras?.suppliers?.name,
            preco: Number(r.preco_unitario ?? 0),
            qty: Number(r.quantidade ?? 0),
            subtotal: Number(r.compras?.subtotal ?? 0),
            desconto: Number(r.compras?.desconto ?? 0),
            pct: Number(r.compras?.subtotal ?? 0) > 0
              ? (Number(r.compras?.desconto ?? 0) / Number(r.compras?.subtotal ?? 0)) * 100
              : 0,
          })),
        };
      });

      return { sale, cvd, items };
    },
  });

  const summary = useMemo(() => {
    if (!data) return null;
    const { sale, cvd, items } = data;
    const subtotal = items.reduce((a, it) => a + it.total_price, 0);
    const desconto = Number(sale.discount ?? 0);
    const juros = Number(sale.mercado_pago_fees ?? 0);
    const freteEmp = Number(sale.frete_empresa ?? 0);
    const receber = Number(sale.total ?? 0);
    const freteCli = Math.max(receber - (subtotal - desconto) + juros, 0);
    const custo = items.reduce((a, it) => a + it.total_cost, 0);
    const lucroBruto = receber - custo - juros - freteEmp;
    const margem = receber > 0 ? (lucroBruto * 100) / receber : 0;
    const markup = custo > 0 ? ((receber - custo) / custo) * 100 : 0;
    const roi = custo > 0 ? (lucroBruto / custo) * 100 : 0;

    const suppliers = Array.from(new Set(items.map((i) => i.supplier).filter(Boolean))) as string[];

    const alerts: string[] = [];
    items.forEach((it) => {
      if (!it.supplier) alerts.push(`⚠ ${it.name}: sem fornecedor vinculado (nenhuma compra encontrada)`);
      if (it.gross_cost <= 0) alerts.push(`⚠ ${it.name}: sem custo cadastrado`);
      if (it.purchases.length > 0 && it.purchases.every((p) => p.desconto === 0)) {
        alerts.push(`⚠ ${it.name}: nenhuma compra tem desconto registrado`);
      }
      if (it.last_purchase_date && new Date(it.last_purchase_date) > new Date(sale.sold_at)) {
        alerts.push(`⚠ ${it.name}: compra considerada é posterior à venda`);
      }
    });
    if (cvd && Math.abs(Number(cvd.custo ?? 0) - custo) > 0.5) {
      alerts.push(`⚠ Divergência de custo: Controle de Vendas mostra ${brl(Number(cvd.custo))} vs. calculado ${brl(custo)}`);
    }

    return { subtotal, desconto, juros, freteEmp, freteCli, receber, custo, lucroBruto, margem, markup, roi, suppliers, alerts };
  }, [data]);

  const exportXlsx = () => {
    if (!data || !summary) return;
    const { sale, items } = data;
    const wb = XLSX.utils.book_new();

    const geral: any[][] = [
      ["Venda", sale.id],
      ["Data", new Date(sale.sold_at).toLocaleString("pt-BR")],
      ["Cliente", sale.customers?.name ?? sale.customer_name ?? "Balcão"],
      ["Canal", sale.channel],
      ["Pagamento", PAGTO_LABEL[sale.payment_method] ?? sale.payment_method],
      ["Status", STATUS_LABEL[sale.status] ?? sale.status],
      ["Fornecedores", summary.suppliers.join(", ") || "—"],
      [],
      ["RESUMO FINANCEIRO"],
      ["Subtotal produtos", summary.subtotal],
      ["Desconto", -summary.desconto],
      ["Frete cliente", summary.freteCli],
      ["Juros Mercado Pago", -summary.juros],
      ["Frete empresa", -summary.freteEmp],
      ["Receber", summary.receber],
      ["Custo produtos (líquido)", -summary.custo],
      ["Lucro bruto", summary.lucroBruto],
      ["Margem %", Number(summary.margem.toFixed(2))],
      ["Markup %", Number(summary.markup.toFixed(2))],
      ["ROI %", Number(summary.roi.toFixed(2))],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(geral), "Resumo");

    const itemsSheet: any[][] = [
      ["Produto", "SKU", "Qtd", "Preço Unit.", "Total Venda", "Fornecedor", "Última Compra", "Custo Bruto", "Desc. %", "Valor Desc.", "Custo Líquido", "Custo Total"],
    ];
    items.forEach((it) => {
      itemsSheet.push([
        it.name, it.sku, it.quantity, it.unit_price, it.total_price,
        it.supplier ?? "—",
        it.last_purchase_date ? new Date(it.last_purchase_date).toLocaleDateString("pt-BR") : "—",
        it.gross_cost, Number(it.discount_pct.toFixed(2)), it.discount_value, it.net_cost, it.total_cost,
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemsSheet), "Produtos");

    XLSX.writeFile(wb, `auditoria_lucro_${sale.id.slice(0, 8)}.xlsx`);
  };

  const exportPdf = async () => {
    if (!data || !summary) return;
    const { sale, items } = data;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"), import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Auditoria da Formação do Lucro", pageW / 2, 14, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Venda ${sale.id.slice(0, 8)} — ${new Date(sale.sold_at).toLocaleString("pt-BR")}`, pageW / 2, 20, { align: "center" });
    doc.text(`Cliente: ${sale.customers?.name ?? sale.customer_name ?? "Balcão"}`, 14, 28);

    autoTable(doc, {
      startY: 34,
      head: [["Produto", "Qtd", "Preço", "Custo Bruto", "Desc%", "Custo Líq.", "Total Custo"]],
      body: items.map((it) => [
        it.name, it.quantity, brl(it.unit_price), brl(it.gross_cost),
        `${it.discount_pct.toFixed(1)}%`, brl(it.net_cost), brl(it.total_cost),
      ]),
      styles: { fontSize: 8 },
    });

    const y = (doc as any).lastAutoTable.finalY + 6;
    autoTable(doc, {
      startY: y,
      head: [["Métrica", "Valor"]],
      body: [
        ["Subtotal produtos", brl(summary.subtotal)],
        ["Desconto", `-${brl(summary.desconto)}`],
        ["Frete cliente", brl(summary.freteCli)],
        ["Juros Mercado Pago", `-${brl(summary.juros)}`],
        ["Frete empresa", `-${brl(summary.freteEmp)}`],
        ["Receber", brl(summary.receber)],
        ["Custo produtos", `-${brl(summary.custo)}`],
        ["Lucro bruto", brl(summary.lucroBruto)],
        ["Margem %", `${summary.margem.toFixed(2)}%`],
        ["Markup %", `${summary.markup.toFixed(2)}%`],
        ["ROI %", `${summary.roi.toFixed(2)}%`],
      ],
      styles: { fontSize: 9 },
    });

    doc.save(`auditoria_lucro_${sale.id.slice(0, 8)}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            🔍 Auditoria da Formação do Lucro
          </DialogTitle>
        </DialogHeader>

        {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Carregando auditoria…</div>}

        {data && summary && (
          <div className="space-y-6 text-sm">
            {/* Ações */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={exportXlsx}>
                <FileSpreadsheet className="size-4 mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <FileText className="size-4 mr-1" /> PDF
              </Button>
            </div>

            {/* Alertas */}
            {summary.alerts.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle className="size-4" /> Alertas Automáticos
                </div>
                <ul className="text-xs text-amber-900 space-y-0.5">
                  {summary.alerts.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            <Tabs defaultValue="lucro" className="w-full">
              <TabsList>
                <TabsTrigger value="lucro">Formação do Lucro</TabsTrigger>
                <TabsTrigger value="rastreabilidade">Rastreabilidade do Custo</TabsTrigger>
              </TabsList>

              <TabsContent value="lucro" className="space-y-6 mt-4">
            {/* Dados Gerais */}
            <section>
              <h3 className="font-display text-base mb-2">📦 Dados Gerais</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Info label="Nº da venda" value={data.sale.id.slice(0, 8)} />
                <Info label="Data" value={new Date(data.sale.sold_at).toLocaleString("pt-BR")} />
                <Info label="Cliente" value={data.sale.customers?.name ?? data.sale.customer_name ?? "Balcão"} />
                <Info label="Canal" value={<span className="capitalize">{data.sale.channel}</span>} />
                <Info label="Pagamento" value={PAGTO_LABEL[data.sale.payment_method] ?? data.sale.payment_method} />
                <Info label="Status" value={<Badge variant="secondary">{STATUS_LABEL[data.sale.status] ?? data.sale.status}</Badge>} />
                <Info label="Fornecedor(es)" value={summary.suppliers.length ? summary.suppliers.join(", ") : "—"} />
              </div>
            </section>

            {/* Produtos */}
            <section>
              <h3 className="font-display text-base mb-2">📦 Produtos da Venda</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border rounded">
                  <thead className="bg-muted/40">
                    <tr className="text-left border-b">
                      <th className="p-2">Produto</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-right">Preço Unit.</th>
                      <th className="p-2 text-right">Total Venda</th>
                      <th className="p-2">Fornecedor</th>
                      <th className="p-2">Última Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="p-2 font-medium">{it.name}</td>
                        <td className="p-2 text-muted-foreground">{it.sku}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right">{brl(it.unit_price)}</td>
                        <td className="p-2 text-right">{brl(it.total_price)}</td>
                        <td className="p-2">{it.supplier ?? "—"}</td>
                        <td className="p-2 text-xs">
                          {it.last_purchase_date
                            ? `${new Date(it.last_purchase_date).toLocaleDateString("pt-BR")}${it.last_purchase_nf ? ` (NF ${it.last_purchase_nf})` : ""}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Formação do Custo */}
            <section>
              <h3 className="font-display text-base mb-2">💰 Formação do Custo</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border rounded">
                  <thead className="bg-muted/40">
                    <tr className="text-left border-b">
                      <th className="p-2">Produto</th>
                      <th className="p-2 text-right">Custo Bruto</th>
                      <th className="p-2 text-right">Desc. %</th>
                      <th className="p-2 text-right">Valor Desc.</th>
                      <th className="p-2 text-right">Custo Líquido</th>
                      <th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-right">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="p-2">{it.name}</td>
                        <td className="p-2 text-right">{brl(it.gross_cost)}</td>
                        <td className="p-2 text-right">{it.discount_pct.toFixed(2)}%</td>
                        <td className="p-2 text-right text-destructive">−{brl(it.discount_value)}</td>
                        <td className="p-2 text-right font-medium">{brl(it.net_cost)}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right font-semibold">{brl(it.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-muted/40">
                      <td className="p-2" colSpan={6}>TOTAL CUSTO LÍQUIDO</td>
                      <td className="p-2 text-right">{brl(summary.custo)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Fórmula: <code>Custo Líquido = Preço Compra × (1 − Desconto / Subtotal da Compra)</code> — média ponderada por quantidade histórica de todas as compras do produto.
              </p>
            </section>

            {/* Resumo da Venda */}
            <section>
              <h3 className="font-display text-base mb-2">📊 Resumo da Venda</h3>
              <div className="rounded-md border divide-y">
                <Line label="Subtotal produtos" value={brl(summary.subtotal)} />
                <Line label="Desconto" value={`−${brl(summary.desconto)}`} tone="negative" />
                <Line label="Frete cobrado do cliente" value={`+${brl(summary.freteCli)}`} tone="positive" />
                <Line label="Juros Mercado Pago" value={`−${brl(summary.juros)}`} tone="negative" />
                <Line label="Frete empresa" value={`−${brl(summary.freteEmp)}`} tone="negative" />
                <Line label="Receber" value={brl(summary.receber)} bold />
                <Line label="Custo produtos (líquido)" value={`−${brl(summary.custo)}`} tone="negative" />
                <Line label="Lucro bruto" value={brl(summary.lucroBruto)} bold tone={summary.lucroBruto >= 0 ? "positive" : "negative"} />
                <Line label="Margem" value={`${summary.margem.toFixed(2)}%`} tone="info" />
              </div>
            </section>

            {/* Memória de cálculo */}
            <section>
              <h3 className="font-display text-base mb-2">🧮 Memória de Cálculo</h3>
              <div className="rounded-md bg-muted/40 p-3 font-mono text-xs whitespace-pre">
{`Receber          ${brl(summary.receber).padStart(14)}
- Custo produtos ${brl(summary.custo).padStart(14)}
- Juros ML       ${brl(summary.juros).padStart(14)}
- Frete empresa  ${brl(summary.freteEmp).padStart(14)}
= LUCRO          ${brl(summary.lucroBruto).padStart(14)}
  Margem         ${(summary.margem.toFixed(2) + "%").padStart(13)}`}
              </div>
            </section>

            {/* Indicadores */}
            <section>
              <h3 className="font-display text-base mb-2">📈 Indicadores</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Margem Bruta" value={`${summary.margem.toFixed(2)}%`} />
                <Metric label="Markup" value={`${summary.markup.toFixed(2)}%`} />
                <Metric label="ROI da Venda" value={`${summary.roi.toFixed(2)}%`} />
                <Metric label="Lucro Absoluto" value={brl(summary.lucroBruto)} />
              </div>
            </section>

            {/* Histórico de compras */}
            <section>
              <h3 className="font-display text-base mb-2">📅 Histórico de Compras Consideradas</h3>
              <div className="space-y-3">
                {data.items.map((it) => (
                  <div key={it.id} className="rounded-md border">
                    <div className="px-3 py-2 bg-muted/40 text-xs font-medium border-b">{it.name}</div>
                    {it.purchases.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">Nenhuma compra encontrada para este produto.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr className="text-left border-b">
                            <th className="p-2">Data</th>
                            <th className="p-2">NF</th>
                            <th className="p-2">Fornecedor</th>
                            <th className="p-2 text-right">Preço</th>
                            <th className="p-2 text-right">Qtd</th>
                            <th className="p-2 text-right">Desc. %</th>
                            <th className="p-2 text-right">Preço Líquido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {it.purchases.map((p, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2">{p.date ? new Date(p.date).toLocaleDateString("pt-BR") : "—"}</td>
                              <td className="p-2">{p.nf ?? "—"}</td>
                              <td className="p-2">{p.supplier ?? "—"}</td>
                              <td className="p-2 text-right">{brl(p.preco)}</td>
                              <td className="p-2 text-right">{p.qty}</td>
                              <td className="p-2 text-right">{p.pct.toFixed(2)}%</td>
                              <td className="p-2 text-right">{brl(p.preco * Math.max(1 - p.pct / 100, 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Divergência com CVD (informativo) */}
            {data.cvd && (
              <section>
                <h3 className="font-display text-base mb-2">🔗 Conferência com Controle de Vendas</h3>
                <div className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Info label="Loja (CVD)" value={brl(Number(data.cvd.loja))} />
                  <Info label="Custo (CVD)" value={brl(Number(data.cvd.custo))} />
                  <Info label="Juros ML (CVD)" value={brl(Number(data.cvd.juros_ml))} />
                  <Info label="Frete Emp. (CVD)" value={brl(Number(data.cvd.frete_empresa))} />
                  <Info label="Frete Cli. (CVD)" value={brl(Number(data.cvd.frete_cliente))} />
                  <Info label="Receber (CVD)" value={brl(Number(data.cvd.receber))} />
                  <Info label="Lucro (CVD)" value={brl(Number(data.cvd.lucro))} />
                </div>
              </section>
            )}
              </TabsContent>

              <TabsContent value="rastreabilidade" className="space-y-4 mt-4">
                <RastreabilidadeCusto items={data.items} saleDate={data.sale.sold_at} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Line({ label, value, tone, bold }: { label: string; value: string; tone?: "positive" | "negative" | "info"; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between px-3 py-2", bold && "font-semibold bg-muted/30")}>
      <span>{label}</span>
      <span className={cn(
        tone === "positive" && "text-emerald-600",
        tone === "negative" && "text-destructive",
        tone === "info" && "text-blue-600",
      )}>{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-primary/5 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-lg">{value}</div>
    </div>
  );
}

type TraceItem = {
  id: string;
  product_id: string | null;
  name: string;
  sku: string;
  brand: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  gross_cost: number;
  net_cost: number;
  discount_value: number;
  discount_pct: number;
  total_cost: number;
  supplier: string | null;
  supplier_delivery_days: number | null;
  supplier_payment_terms: string | null;
  last_purchase_date: string | null;
  last_purchase_nf: string | null;
  last_compra_id: string | null;
  last_item_id: string | null;
  last_pct: number;
  last_gross_price: number;
  last_net_price: number;
  purchases: Array<{
    compra_id?: string; item_id?: string;
    date?: string; nf?: string; supplier?: string;
    preco: number; qty: number; subtotal: number; desconto: number; pct: number;
  }>;
};

function RastreabilidadeCusto({ items, saleDate }: { items: TraceItem[]; saleDate: string }) {
  if (items.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item nesta venda.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <strong>🔍 Rastreabilidade do Custo</strong> — Auditoria detalhada, item por item, de onde veio o custo aplicado a esta venda. Consulta 100% read-only.
      </div>
      {items.map((it) => (
        <TraceCard key={it.id} item={it} saleDate={saleDate} />
      ))}
    </div>
  );
}

function TraceCard({ item, saleDate }: { item: TraceItem; saleDate: string }) {
  const saleDt = new Date(saleDate);
  const purchaseDt = item.last_purchase_date ? new Date(item.last_purchase_date) : null;

  // Auditorias
  const semCompra = item.purchases.length === 0;
  const posterior = purchaseDt ? purchaseDt > saleDt : false;
  const semFornecedor = !item.supplier;
  const semDesconto = item.purchases.length > 0 && item.purchases.every((p) => p.desconto === 0);
  const custoNegativo = item.net_cost < 0;
  const descMaiorQueSub = item.purchases.some((p) => p.desconto > p.subtotal && p.subtotal > 0);
  const semProduto = !item.product_id;

  const alertas: string[] = [];
  if (semCompra) alertas.push("Sem compra registrada para este produto");
  if (posterior) alertas.push("Compra utilizada é posterior à data da venda");
  if (semFornecedor) alertas.push("Fornecedor não identificado");
  if (semDesconto && item.purchases.length > 0) alertas.push("Nenhuma compra deste produto possui desconto registrado");
  if (custoNegativo) alertas.push("Custo líquido negativo detectado");
  if (descMaiorQueSub) alertas.push("Desconto maior que subtotal em alguma compra");
  if (semProduto) alertas.push("Produto inexistente / referência quebrada");
  if (item.gross_cost <= 0 && !semCompra) alertas.push("Custo bruto do produto cadastrado como zero");

  // Origem do custo
  const origem = semCompra
    ? item.gross_cost > 0 ? "Produto (cadastro)" : "Valor manual / zerado"
    : "Média ponderada de compras";

  // Diagnóstico
  let diagnostico: { level: "ok" | "warn" | "err"; texto: string };
  if (custoNegativo || descMaiorQueSub || semProduto) {
    diagnostico = { level: "err", texto: "Divergência encontrada" };
  } else if (posterior) {
    diagnostico = { level: "err", texto: "Divergência temporal — compra posterior à venda" };
  } else if (semCompra) {
    diagnostico = { level: "warn", texto: "Custo obtido do cadastro do produto — sem histórico de compras" };
  } else if (semFornecedor || semDesconto) {
    diagnostico = { level: "warn", texto: "Atenção — dados incompletos" };
  } else {
    diagnostico = { level: "ok", texto: "Custo correto — todas as regras validadas" };
  }

  // Conclusão
  let conclusao: string;
  if (diagnostico.level === "ok") {
    conclusao = "O custo apresentado nesta venda é compatível com todas as regras financeiras do Vejamais.";
  } else if (posterior) {
    conclusao = "Foi encontrada divergência temporal — a compra considerada é posterior à venda.";
  } else if (semCompra) {
    conclusao = "Não há compra registrada para este produto; custo derivado do cadastro.";
  } else if (semFornecedor) {
    conclusao = "Foi encontrada divergência de fornecedor.";
  } else if (semDesconto) {
    conclusao = "Foi encontrada divergência de desconto.";
  } else {
    conclusao = "Foi encontrada divergência de origem do custo.";
  }

  const purchasesSorted = [...item.purchases].sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const totalQtyCompras = purchasesSorted.reduce((s, p) => s + p.qty, 0);

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header */}
      <div className={cn(
        "px-4 py-3 border-b flex items-center justify-between gap-3",
        diagnostico.level === "ok" && "bg-emerald-50",
        diagnostico.level === "warn" && "bg-amber-50",
        diagnostico.level === "err" && "bg-red-50",
      )}>
        <div>
          <div className="font-semibold">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            SKU {item.sku} · {item.brand} · {item.category}
          </div>
        </div>
        <DiagnosticoBadge level={diagnostico.level} texto={diagnostico.texto} />
      </div>

      <div className="p-4 space-y-4 text-sm">
        {/* 2. Venda */}
        <TraceBlock title="1. Venda">
          <TraceRow label="Data" value={saleDt.toLocaleDateString("pt-BR")} />
          <TraceRow label="Quantidade vendida" value={String(item.quantity)} />
          <TraceRow label="Preço unitário" value={brl(item.unit_price)} />
          <TraceRow label="Preço total" value={brl(item.total_price)} />
        </TraceBlock>

        {/* 3+4. Compra + Fornecedor */}
        <TraceBlock title="2. Compra utilizada (referência)">
          {semCompra ? (
            <div className="text-xs text-muted-foreground">Nenhuma compra encontrada para este produto.</div>
          ) : (
            <>
              <TraceRow label="Fornecedor" value={item.supplier ?? "—"} />
              <TraceRow label="NF" value={item.last_purchase_nf ?? "—"} />
              <TraceRow label="Data da compra" value={purchaseDt ? purchaseDt.toLocaleDateString("pt-BR") : "—"} />
              <TraceRow label="ID da compra" value={item.last_compra_id ? String(item.last_compra_id).slice(0, 8) : "—"} mono />
              <TraceRow label="ID do item" value={item.last_item_id ? String(item.last_item_id).slice(0, 8) : "—"} mono />
              <TraceRow label="Prazo entrega (fornec.)" value={item.supplier_delivery_days != null ? `${item.supplier_delivery_days} dia(s)` : "—"} />
              <TraceRow label="Condição comercial" value={item.supplier_payment_terms ?? "—"} />
            </>
          )}
        </TraceBlock>

        {/* 5-7. Valores */}
        <TraceBlock title="3. Formação do valor (último compra)">
          <TraceRow label="Preço bruto (última compra)" value={brl(item.last_gross_price || item.gross_cost)} />
          <TraceRow
            label="Desconto aplicado"
            value={`${item.last_pct.toFixed(2)}%  ·  ${brl((item.last_gross_price || item.gross_cost) * item.last_pct / 100)}`}
          />
          <TraceRow label="Origem do desconto" value={item.last_purchase_nf ? `Compra NF ${item.last_purchase_nf}` : "—"} />
          <TraceRow
            label="Preço líquido (última compra)"
            value={brl(item.last_net_price || item.net_cost)}
            bold
          />
          <div className="rounded bg-muted/40 px-3 py-2 font-mono text-xs mt-2">
            {brl(item.last_gross_price || item.gross_cost)} − {brl((item.last_gross_price || item.gross_cost) * item.last_pct / 100)} = {brl(item.last_net_price || item.net_cost)}
          </div>
        </TraceBlock>

        {/* 8. Quantidade */}
        <TraceBlock title="4. Quantidade e custo total (aplicado à venda)">
          <TraceRow label="Custo líquido unitário (média ponderada)" value={brl(item.net_cost)} bold />
          <TraceRow label="Quantidade vendida" value={String(item.quantity)} />
          <TraceRow label="Custo total do item" value={brl(item.total_cost)} bold />
        </TraceBlock>

        {/* 11. Origem */}
        <TraceBlock title="5. Origem do custo">
          <div className="text-xs">{origem}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs mt-2">
            <OrigemFlag label="Compra" on={!semCompra} />
            <OrigemFlag label="Produto" on={semCompra && item.gross_cost > 0} />
            <OrigemFlag label="Valor Manual" on={semCompra && item.gross_cost <= 0} />
            <OrigemFlag label="Média Ponderada" on={item.purchases.length > 1} />
            <OrigemFlag label="Última Compra" on={item.purchases.length === 1} />
            <OrigemFlag label="Estoque" on={false} />
            <OrigemFlag label="FIFO" on={false} />
          </div>
        </TraceBlock>

        {/* 12-14. Auditorias */}
        <TraceBlock title="6. Auditorias automáticas">
          <AuditRow ok={!posterior && !!purchaseDt} label="Compra ocorreu antes da venda?"
            detail={purchaseDt ? `Venda ${saleDt.toLocaleDateString("pt-BR")} · Compra ${purchaseDt.toLocaleDateString("pt-BR")}` : "Sem data de compra"} />
          <AuditRow ok={!semDesconto || item.purchases.length === 0} label="Desconto aplicado corretamente?"
            detail={`Percentual aplicado: ${item.discount_pct.toFixed(2)}%`} />
          <AuditRow ok={!semFornecedor} label="Fornecedor identificado?"
            detail={item.supplier ?? "sem fornecedor"} />
          <AuditRow ok={!custoNegativo && !descMaiorQueSub} label="Consistência numérica?"
            detail={custoNegativo ? "custo negativo" : descMaiorQueSub ? "desconto > subtotal" : "ok"} />
        </TraceBlock>

        {/* 15. Custo médio (todas compras) */}
        <TraceBlock title="7. Todas as compras do produto (base do custo médio)">
          {purchasesSorted.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhuma compra registrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border rounded">
                <thead className="bg-muted/40">
                  <tr className="text-left border-b">
                    <th className="p-2">Data</th>
                    <th className="p-2">Fornecedor</th>
                    <th className="p-2">NF</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-right">Preço</th>
                    <th className="p-2 text-right">Desc.%</th>
                    <th className="p-2 text-right">Preço Líq.</th>
                    <th className="p-2 text-right">Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasesSorted.map((p, i) => {
                    const liq = p.preco * Math.max(1 - p.pct / 100, 0);
                    const peso = totalQtyCompras > 0 ? (p.qty / totalQtyCompras) * 100 : 0;
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2">{p.date ? new Date(p.date).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-2">{p.supplier ?? "—"}</td>
                        <td className="p-2">{p.nf ?? "—"}</td>
                        <td className="p-2 text-right">{p.qty}</td>
                        <td className="p-2 text-right">{brl(p.preco)}</td>
                        <td className="p-2 text-right">{p.pct.toFixed(2)}%</td>
                        <td className="p-2 text-right font-medium">{brl(liq)}</td>
                        <td className="p-2 text-right">{peso.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TraceBlock>

        {/* 16. Linha do tempo */}
        <TraceBlock title="8. Linha do tempo">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <TimelineStep label="Compra" date={purchaseDt ? purchaseDt.toLocaleDateString("pt-BR") : "—"} />
            <span>→</span>
            <TimelineStep label="Entrada Estoque" date={purchaseDt ? purchaseDt.toLocaleDateString("pt-BR") : "—"} />
            <span>→</span>
            <TimelineStep label="Venda" date={saleDt.toLocaleDateString("pt-BR")} />
            <span>→</span>
            <TimelineStep label="Controle de Vendas" date="sync" />
            <span>→</span>
            <TimelineStep label="Lucro" date="calculado" />
          </div>
        </TraceBlock>

        {/* 17. Alertas */}
        {alertas.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3">
            <div className="flex items-center gap-2 font-semibold text-amber-900 text-xs">
              <AlertCircle className="size-4" /> Alertas
            </div>
            <ul className="mt-1 text-xs text-amber-900 space-y-0.5 list-disc list-inside">
              {alertas.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        {/* 19. Conclusão */}
        <div className={cn(
          "rounded p-3 text-xs border",
          diagnostico.level === "ok" && "border-emerald-300 bg-emerald-50 text-emerald-900",
          diagnostico.level === "warn" && "border-amber-300 bg-amber-50 text-amber-900",
          diagnostico.level === "err" && "border-red-300 bg-red-50 text-red-900",
        )}>
          <strong>Conclusão: </strong>{conclusao}
        </div>
      </div>
    </div>
  );
}

function TraceBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border">
      <div className="px-3 py-2 bg-muted/30 border-b text-xs font-semibold">{title}</div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}

function TraceRow({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold && "font-semibold", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function AuditRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
        <span>{label}</span>
      </div>
      {detail && <span className="text-muted-foreground">{detail}</span>}
    </div>
  );
}

function OrigemFlag({ label, on }: { label: string; on: boolean }) {
  return (
    <div className={cn("flex items-center gap-1", !on && "text-muted-foreground/60")}>
      <span>{on ? "☑" : "☐"}</span>
      <span>{label}</span>
    </div>
  );
}

function TimelineStep({ label, date }: { label: string; date: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1">
      <div className="font-medium text-foreground text-[11px]">{label}</div>
      <div className="text-[10px]">{date}</div>
    </div>
  );
}

function DiagnosticoBadge({ level, texto }: { level: "ok" | "warn" | "err"; texto: string }) {
  const cls = level === "ok" ? "bg-emerald-600" : level === "warn" ? "bg-amber-500" : "bg-red-600";
  const icon = level === "ok" ? "🟢" : level === "warn" ? "🟡" : "🔴";
  return (
    <div className={cn("text-white text-xs rounded px-2 py-1 font-medium whitespace-nowrap", cls)}>
      {icon} {texto}
    </div>
  );
}
