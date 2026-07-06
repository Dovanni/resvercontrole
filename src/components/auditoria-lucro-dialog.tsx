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
          .select("produto_id, quantidade, preco_unitario, compras(id, data_compra, numero_nf, subtotal, desconto, fornecedor_id, suppliers(name))")
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
          quantity: Number(it.quantity ?? 0),
          unit_price: Number(it.unit_price ?? 0),
          total_price: Number(it.quantity ?? 0) * Number(it.unit_price ?? 0),
          gross_cost: grossCost,
          net_cost: netCost,
          discount_value: Math.max(grossCost - netCost, 0),
          discount_pct: grossCost > 0 ? Math.max((1 - netCost / grossCost) * 100, 0) : 0,
          total_cost: netCost * Number(it.quantity ?? 0),
          supplier: last?.compras?.suppliers?.name ?? null,
          last_purchase_date: last?.compras?.data_compra ?? null,
          last_purchase_nf: last?.compras?.numero_nf ?? null,
          last_pct: lastPct,
          purchases: rows.map((r) => ({
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
