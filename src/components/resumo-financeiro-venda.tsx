import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { AuditoriaLucroDialog } from "@/components/auditoria-lucro-dialog";

type Item = { product_id: string; quantity: number; unit_price: number };

type Props = {
  items: Item[];
  subtotal: number;
  discountValue: number;
  shipping: number;
  mercadoPagoFees: number;
  freteEmpresa: number;
  receber: number;
  saleId?: string | null;
};

export function ResumoFinanceiroVenda({
  items, subtotal, discountValue, shipping, mercadoPagoFees, freteEmpresa, receber, saleId,
}: Props) {
  const productIds = useMemo(
    () => Array.from(new Set(items.map(i => i.product_id).filter(Boolean))),
    [items]
  );

  const { data: netCostByProduct, isLoading } = useQuery({
    enabled: productIds.length > 0,
    queryKey: ["resumo-financeiro-net-cost", productIds.slice().sort()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_itens")
        .select("produto_id, quantidade, preco_unitario, compras(subtotal, desconto)")
        .in("produto_id", productIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      const byProd: Record<string, any[]> = {};
      for (const r of (data ?? []) as any[]) {
        (byProd[r.produto_id] ||= []).push(r);
      }
      for (const pid of productIds) {
        const rows = byProd[pid] ?? [];
        let sumWeighted = 0;
        let sumQ = 0;
        for (const r of rows) {
          const q = Number(r.quantidade ?? 0);
          const sub = Number(r.compras?.subtotal ?? 0);
          const desc = Number(r.compras?.desconto ?? 0);
          const factor = sub > 0 ? Math.max(1 - desc / sub, 0) : 1;
          sumWeighted += q * Number(r.preco_unitario ?? 0) * factor;
          sumQ += q;
        }
        map[pid] = sumQ > 0 ? sumWeighted / sumQ : 0;
      }
      return map;
    },
  });

  const custoProdutos = useMemo(() => {
    if (!netCostByProduct) return null;
    let total = 0;
    for (const it of items) {
      const c = netCostByProduct[it.product_id];
      if (c == null) return null;
      total += c * Number(it.quantity ?? 0);
    }
    return total;
  }, [items, netCostByProduct]);

  const canCompute = custoProdutos !== null && !isLoading;
  const lucro = canCompute ? receber - (custoProdutos as number) - (Number(freteEmpresa) || 0) : 0;
  const margem = canCompute && receber > 0 ? (lucro / receber) * 100 : 0;

  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <>
      <div className="rounded-md border p-4 space-y-2 bg-card">
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-sm font-semibold">📊 RESUMO FINANCEIRO DA VENDA</span>
        </div>

        <Row label="Subtotal Produtos" value={brl(subtotal)} />
        <Row label="Desconto" value={`−${brl(discountValue)}`} tone="negative" />
        <Row label="Frete Cliente" value={`+${brl(Number(shipping) || 0)}`} />
        <Row label="Juros Mercado Pago" value={`−${brl(Number(mercadoPagoFees) || 0)}`} tone="negative" />

        <div className="border-t pt-2 flex justify-between items-center">
          <span className="text-sm font-medium">Receber</span>
          <span className="text-lg font-display text-emerald-600 dark:text-emerald-400 font-semibold">
            {brl(receber)}
          </span>
        </div>

        <div className="border-t pt-2 space-y-2">
          {!canCompute ? (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ Aguardando cálculo do custo...
            </div>
          ) : (
            <>
              <Row label="Custo Produtos" value={brl(custoProdutos as number)} />
              <Row label="Frete Empresa" value={brl(Number(freteEmpresa) || 0)} />

              <div className="border-t pt-2 flex justify-between items-center">
                <span className="text-sm font-medium">Lucro Previsto</span>
                <span
                  className={`text-lg font-display font-semibold ${
                    lucro >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {brl(lucro)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Margem</span>
                <span className="text-base font-display font-semibold text-blue-600 dark:text-blue-400">
                  {margem.toFixed(2)}%
                </span>
              </div>
            </>
          )}
        </div>

        {saleId && (
          <div className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAuditOpen(true)}
            >
              <Search className="mr-2 h-4 w-4" />
              Ver Auditoria Financeira
            </Button>
          </div>
        )}
      </div>

      {saleId && (
        <AuditoriaLucroDialog
          saleId={auditOpen ? saleId : null}
          onClose={() => setAuditOpen(false)}
        />
      )}
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "negative" }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "negative" ? "text-red-600 dark:text-red-400" : ""}>{value}</span>
    </div>
  );
}
