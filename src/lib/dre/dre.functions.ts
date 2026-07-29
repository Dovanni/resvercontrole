import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { computeDre, toAmountMap, type RawClassified, type RawSale } from "./engine";
import { lastYearPeriod, previousPeriod, resolvePreset } from "./periods";
import { resolveTenant } from "./tenant";
import type { ComparisonMode, DreGroup, DrePayload, DrePeriod, PeriodPreset } from "./types";

/** Evita que o supabase-js faça parsing type-level das strings de select. */
const sel = (s: string): string => s;

export interface DreRequest {
  preset: PeriodPreset;
  from?: string;
  to?: string;
  comparison?: ComparisonMode;
  /** Preferência do cliente. Nunca autoriza: é confrontada com o tenant do token. */
  empresaId?: string | null;
  timezone?: string | null;
}

interface RuleRow {
  match_category: string | null;
  match_supplier_id: string | null;
  dre_group: string;
}

interface OverrideRow {
  source_table: string;
  source_id: string;
  dre_group: string;
}

interface PayableRow {
  id: string;
  description: string;
  category: string;
  supplier_id: string | null;
  amount: number;
  due_date: string;
  status: string;
  suppliers: { name: string } | null;
}

interface ReceivableRow {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  sale_id: string | null;
}

interface SaleRow {
  id: string;
  sold_at: string;
  status: string;
  channel: string;
  customer_name: string | null;
  discount: number;
  total: number;
  frete_empresa: number | null;
  mercado_pago_fees: number | null;
  customers: { name: string } | null;
  sale_items: { quantity: number; unit_price: number; unit_cost: number }[];
}

const SALE_SELECT = sel(
  "id, sold_at, status, channel, customer_name, discount, total, frete_empresa, mercado_pago_fees, customers(name), sale_items(quantity, unit_price, unit_cost)",
);

function keyOf(supplierId: string | null, category: string | null) {
  return `${supplierId ?? ""}|${category ?? ""}`;
}

/**
 * Precedência de classificação:
 *   1. override por lançamento (dre_classificacoes)
 *   2. regra fornecedor + categoria
 *   3. regra fornecedor
 *   4. regra categoria
 *   5. NAO_CLASSIFICADO
 */
function classifyPayable(
  p: PayableRow,
  rules: Map<string, string>,
  overrides: Map<string, string>,
): DreGroup {
  const o = overrides.get(`payables|${p.id}`);
  if (o) return o as DreGroup;
  return (rules.get(keyOf(p.supplier_id, p.category)) ??
    rules.get(keyOf(p.supplier_id, null)) ??
    rules.get(keyOf(null, p.category)) ??
    "NAO_CLASSIFICADO") as DreGroup;
}

/** Cliente Supabase autenticado (RLS como o usuário). Tipagem estrutural mínima. */
type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

async function loadPeriod(
  supabase: SupabaseLike,
  tenantId: string,
  timezone: string,
  period: DrePeriod,
) {
  // Janela alargada em UTC: o recorte fino é por data civil, dentro do motor.
  const fromTs = new Date(Date.parse(period.from + "T00:00:00Z") - 36 * 3600_000).toISOString();
  const toTs = new Date(Date.parse(period.to + "T00:00:00Z") + 60 * 3600_000).toISOString();

  const [salesRes, payRes, recRes, ruleRes, ovrRes] = await Promise.all([
    supabase.from("sales").select(SALE_SELECT).gte("sold_at", fromTs).lte("sold_at", toTs),
    supabase
      .from("payables")
      .select(sel("id, description, category, supplier_id, amount, due_date, status, suppliers(name)"))
      .gte("due_date", period.from)
      .lte("due_date", period.to),
    supabase
      .from("receivables")
      .select(sel("id, description, amount, due_date, status, sale_id"))
      .gte("due_date", period.from)
      .lte("due_date", period.to),
    supabase.from("dre_regras").select(sel("match_category, match_supplier_id, dre_group")).eq("source_table", "payables"),
    supabase.from("dre_classificacoes").select(sel("source_table, source_id, dre_group")),
  ]);

  for (const r of [salesRes, payRes, recRes, ruleRes, ovrRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const rules = new Map<string, string>();
  for (const r of (ruleRes.data ?? []) as RuleRow[]) {
    rules.set(keyOf(r.match_supplier_id, r.match_category), r.dre_group);
  }
  const overrides = new Map<string, string>();
  for (const o of (ovrRes.data ?? []) as OverrideRow[]) {
    overrides.set(`${o.source_table}|${o.source_id}`, o.dre_group);
  }

  const sales: RawSale[] = ((salesRes.data ?? []) as SaleRow[]).map((s) => ({
    id: s.id,
    sold_at: s.sold_at,
    status: s.status,
    channel: s.channel,
    customer_name: s.customer_name,
    customer: s.customers?.name ?? null,
    discount: s.discount,
    total: s.total,
    frete_empresa: s.frete_empresa,
    mercado_pago_fees: s.mercado_pago_fees,
    items: s.sale_items ?? [],
  }));

  const classified: RawClassified[] = [];

  for (const p of (payRes.data ?? []) as PayableRow[]) {
    if (p.status === "cancelado") continue;
    classified.push({
      id: p.id,
      date: p.due_date,
      label: `${p.suppliers?.name ? p.suppliers.name + " — " : ""}${p.description}`,
      amount: p.amount,
      group: classifyPayable(p, rules, overrides),
      source: "payables",
    });
  }

  for (const r of (recRes.data ?? []) as ReceivableRow[]) {
    if (r.status === "cancelado") continue;
    // Recebíveis atrelados a vendas são LIQUIDAÇÃO: a receita já foi
    // reconhecida por competência em `sales`. Nunca entram no DRE.
    const group = r.sale_id
      ? "FORA_LIQUIDACAO"
      : ((overrides.get(`receivables|${r.id}`) as DreGroup | undefined) ?? "FORA_APORTE");
    classified.push({
      id: r.id,
      date: r.due_date,
      label: r.description,
      amount: r.amount,
      group,
      source: "receivables",
    });
  }

  return { sales, classified, tenantId, timezone, period };
}

export const getDreReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: DreRequest) => {
    const presets: PeriodPreset[] = [
      "mes_atual", "mes_anterior", "trimestre_atual", "trimestre_anterior",
      "semestre_atual", "semestre_anterior", "ano_atual", "ano_anterior",
      "acumulado_ano", "ultimos_12_meses", "personalizado",
    ];
    if (!presets.includes(data.preset)) throw new Error("Período inválido.");
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (data.from && !iso.test(data.from)) throw new Error("Data inicial inválida.");
    if (data.to && !iso.test(data.to)) throw new Error("Data final inválida.");
    const modes: ComparisonMode[] = ["none", "previous", "last_year"];
    if (data.comparison && !modes.includes(data.comparison)) throw new Error("Comparativo inválido.");
    return data;
  })
  .handler(async ({ data, context }): Promise<DrePayload> => {
    const tenant = resolveTenant(context.userId, data.empresaId, data.timezone);
    const supabase = context.supabase;

    const period = resolvePreset(data.preset, tenant.timezone, {
      from: data.from ?? "",
      to: data.to ?? "",
    });

    const current = computeDre(
      await loadPeriod(supabase, tenant.tenantId, tenant.timezone, period),
    );

    const mode: ComparisonMode = data.comparison ?? "none";
    let comparison = null as DrePayload["comparison"];
    if (mode !== "none") {
      const cmpPeriod = mode === "previous" ? previousPeriod(period) : lastYearPeriod(period);
      const cmp = computeDre(
        await loadPeriod(supabase, tenant.tenantId, tenant.timezone, cmpPeriod),
      );
      comparison = { period: cmpPeriod, amountByLineKey: toAmountMap(cmp) };
    }

    return { current, comparison, comparisonMode: mode };
  });
