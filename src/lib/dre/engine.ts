/**
 * Motor canônico de cálculo do DRE Tradicional por Competência.
 *
 * Função pura: recebe as linhas brutas já filtradas por tenant e devolve o
 * `DreResult`. Tela, PDF e XLSX consomem este mesmo objeto.
 *
 * Toda a aritmética é feita em CENTAVOS inteiros.
 */

import { civilDateInTz, formatCivil, monthKey, monthKeyLabel, monthsBetween } from "./periods";
import {
  DEFAULT_TIMEZONE,
  DRE_GROUP_LABEL,
  type DreDetailRow,
  type DreGroup,
  type DreLine,
  type DreMonthlyColumn,
  type DrePeriod,
  type DreResult,
  type LineNature,
} from "./types";

export const toCents = (v: unknown): number => Math.round(Number(v ?? 0) * 100);

/* ------------------------------ entradas ------------------------------ */

export interface RawSaleItem {
  quantity: number | string;
  unit_price: number | string;
  unit_cost: number | string;
}

export interface RawSale {
  id: string;
  sold_at: string;
  status: string;
  channel: string;
  customer_name: string | null;
  customer?: string | null;
  discount: number | string;
  total: number | string;
  frete_empresa: number | string | null;
  mercado_pago_fees: number | string | null;
  items: RawSaleItem[];
}

export interface RawClassified {
  id: string;
  date: string; // data civil de competência (YYYY-MM-DD)
  label: string;
  amount: number | string;
  group: DreGroup;
  source: string;
}

export interface DreEngineInput {
  tenantId: string;
  timezone: string;
  period: DrePeriod;
  sales: RawSale[];
  /** payables e receivables já resolvidos para um grupo do DRE. */
  classified: RawClassified[];
}

/* ------------------------------ auxiliares ------------------------------ */

const SALE_EXCLUDED_CHANNELS = new Set(["recursos_financeiros"]);
const SALE_CANCELLED = new Set(["cancelado", "cancelada"]);

interface Bucket {
  cents: number;
  detail: DreDetailRow[];
}

function emptyBucket(): Bucket {
  return { cents: 0, detail: [] };
}

function add(b: Record<string, Bucket>, key: string, cents: number, row?: DreDetailRow) {
  b[key] ??= emptyBucket();
  b[key].cents += cents;
  if (row) b[key].detail.push(row);
}

function pct(part: number, base: number): number | null {
  if (!base) return null;
  return Math.round((part / base) * 10000) / 100;
}

/* ------------------------------ motor ------------------------------ */

export function computeDre(input: DreEngineInput): DreResult {
  const tz = input.timezone || DEFAULT_TIMEZONE;
  const { from, to } = input.period;
  const buckets: Record<string, Bucket> = {};
  const monthlyRaw: Record<string, Record<string, number>> = {};

  const bump = (month: string, key: string, cents: number) => {
    monthlyRaw[month] ??= {};
    monthlyRaw[month][key] = (monthlyRaw[month][key] ?? 0) + cents;
  };

  /* -------- vendas: receita bruta, deduções e CMV (competência) -------- */
  for (const s of input.sales) {
    if (SALE_EXCLUDED_CHANNELS.has(s.channel)) continue;
    const d = civilDateInTz(s.sold_at, tz);
    if (d < from || d > to) continue;

    const mk = monthKey(d);
    const who = s.customer ?? s.customer_name ?? "Balcão";
    const grossItems = s.items.reduce(
      (acc, i) => acc + Math.round(Number(i.quantity) * toCents(i.unit_price)),
      0,
    );
    const cmv = s.items.reduce(
      (acc, i) => acc + Math.round(Number(i.quantity) * toCents(i.unit_cost)),
      0,
    );
    const discount = toCents(s.discount);
    const total = toCents(s.total);
    const fees = toCents(s.mercado_pago_fees);
    const freteEmpresa = toCents(s.frete_empresa);

    if (SALE_CANCELLED.has(s.status)) {
      add(buckets, "DEDUCAO_CANCELAMENTO", grossItems, {
        id: s.id,
        source: "sales",
        date: d,
        label: `${formatCivil(d)} — ${who} (cancelada)`,
        amountCents: grossItems,
      });
      bump(mk, "DEDUCAO_CANCELAMENTO", grossItems);
      continue;
    }

    // Frete cobrado do cliente = parte do total que não corresponde à
    // mercadoria líquida de desconto, recompondo as taxas do meio de pagamento.
    const freteCliente = Math.max(total - (grossItems - discount) + fees, 0);

    add(buckets, "RECEITA_PRODUTOS", grossItems, {
      id: s.id,
      source: "sales",
      date: d,
      label: `${formatCivil(d)} — ${who}`,
      amountCents: grossItems,
    });
    bump(mk, "RECEITA_PRODUTOS", grossItems);

    if (freteCliente) {
      add(buckets, "RECEITA_FRETE", freteCliente, {
        id: s.id,
        source: "sales",
        date: d,
        label: `${formatCivil(d)} — ${who} (frete cobrado)`,
        amountCents: freteCliente,
      });
      bump(mk, "RECEITA_FRETE", freteCliente);
    }
    if (discount) {
      add(buckets, "DEDUCAO_DESCONTO", discount, {
        id: s.id,
        source: "sales",
        date: d,
        label: `${formatCivil(d)} — ${who}`,
        amountCents: discount,
      });
      bump(mk, "DEDUCAO_DESCONTO", discount);
    }
    if (cmv) {
      add(buckets, "CMV", cmv, {
        id: s.id,
        source: "sale_items",
        date: d,
        label: `${formatCivil(d)} — ${who}`,
        amountCents: cmv,
      });
      bump(mk, "CMV", cmv);
    }
    if (freteEmpresa) {
      add(buckets, "DESP_LOGISTICA", freteEmpresa, {
        id: s.id,
        source: "sales.frete_empresa",
        date: d,
        label: `${formatCivil(d)} — ${who} (frete da empresa)`,
        amountCents: freteEmpresa,
      });
      bump(mk, "DESP_LOGISTICA", freteEmpresa);
    }
    if (fees) {
      add(buckets, "DESP_FINANCEIRA", fees, {
        id: s.id,
        source: "sales.mercado_pago_fees",
        date: d,
        label: `${formatCivil(d)} — ${who} (taxas do meio de pagamento)`,
        amountCents: fees,
      });
      bump(mk, "DESP_FINANCEIRA", fees);
    }
  }

  /* -------- obrigações e recebimentos já classificados -------- */
  for (const c of input.classified) {
    if (c.date < from || c.date > to) continue;
    const cents = toCents(c.amount);
    if (!cents) continue;
    add(buckets, c.group, cents, {
      id: c.id,
      source: c.source,
      date: c.date,
      label: `${formatCivil(c.date)} — ${c.label}`,
      amountCents: cents,
    });
    bump(monthKey(c.date), c.group, cents);
  }

  const g = (k: string) => buckets[k]?.cents ?? 0;
  const detail = (k: string) =>
    (buckets[k]?.detail ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));

  /* -------- consolidação -------- */
  const receitaBruta =
    g("RECEITA_PRODUTOS") + g("RECEITA_SERVICOS") + g("RECEITA_FRETE") + g("RECEITA_OUTRAS");
  const deducoes =
    g("DEDUCAO_DESCONTO") +
    g("DEDUCAO_DEVOLUCAO") +
    g("DEDUCAO_CANCELAMENTO") +
    g("DEDUCAO_TRIBUTO");
  const receitaLiquida = receitaBruta - deducoes;
  const cmvTotal = g("CMV");
  const lucroBruto = receitaLiquida - cmvTotal;

  const despComercial = g("DESP_COMERCIAL") + g("DESP_LOGISTICA");
  const despOperacionais =
    despComercial +
    g("DESP_ADMINISTRATIVA") +
    g("DESP_MANUTENCAO_TI") +
    g("DESP_PESSOAL") +
    g("DESP_OCUPACAO") +
    g("DESP_TRIBUTARIA") +
    g("DESP_OUTRAS");

  const ebitda = lucroBruto - despOperacionais;
  const depreciacao = g("DEPRECIACAO");
  const ebit = ebitda - depreciacao;
  const recFin = g("REC_FINANCEIRA");
  const despFin = g("DESP_FINANCEIRA");
  const resultadoFinanceiro = recFin - despFin;
  const lair = ebit + resultadoFinanceiro;
  const tributos = g("IRPJ_CSLL");
  const resultadoLiquido = lair - tributos;

  const base = receitaLiquida;
  const L = (
    key: string,
    label: string,
    level: 0 | 1 | 2,
    kind: DreLine["kind"],
    nature: LineNature,
    amountCents: number,
    opts: { detail?: DreDetailRow[]; notConfigured?: boolean } = {},
  ): DreLine => ({
    key,
    label,
    level,
    kind,
    nature,
    amountCents,
    percentOfNetRevenue: kind === "header" ? null : pct(amountCents, base),
    notConfigured: opts.notConfigured,
    detail: opts.detail && opts.detail.length ? opts.detail : undefined,
  });

  const item = (group: DreGroup, nature: LineNature, level: 1 | 2 = 1): DreLine =>
    L(group, DRE_GROUP_LABEL[group], level, "item", nature, g(group), { detail: detail(group) });

  const lines: DreLine[] = [
    L("H_RECEITA_BRUTA", "1. Receita operacional bruta", 0, "header", "receita", receitaBruta),
    item("RECEITA_PRODUTOS", "receita"),
    item("RECEITA_SERVICOS", "receita"),
    item("RECEITA_FRETE", "receita"),
    item("RECEITA_OUTRAS", "receita"),
    L("T_RECEITA_BRUTA", "Total da receita operacional bruta", 0, "subtotal", "receita", receitaBruta),

    L("H_DEDUCOES", "2. Deduções da receita bruta", 0, "header", "despesa", deducoes),
    item("DEDUCAO_DESCONTO", "despesa"),
    item("DEDUCAO_DEVOLUCAO", "despesa"),
    item("DEDUCAO_CANCELAMENTO", "despesa"),
    item("DEDUCAO_TRIBUTO", "despesa"),
    L("T_DEDUCOES", "Total das deduções", 0, "subtotal", "despesa", deducoes),

    L("T_RECEITA_LIQUIDA", "3. Receita operacional líquida", 0, "total", "receita", receitaLiquida),

    L("H_CMV", "4. CMV / CPV / CSP", 0, "header", "despesa", cmvTotal),
    item("CMV", "despesa"),

    L("T_LUCRO_BRUTO", "5. Lucro bruto", 0, "total", "resultado", lucroBruto),

    L("H_DESPESAS", "6. Despesas operacionais", 0, "header", "despesa", despOperacionais),
    item("DESP_COMERCIAL", "despesa"),
    item("DESP_LOGISTICA", "despesa"),
    item("DESP_ADMINISTRATIVA", "despesa"),
    item("DESP_MANUTENCAO_TI", "despesa"),
    item("DESP_PESSOAL", "despesa"),
    item("DESP_OCUPACAO", "despesa"),
    item("DESP_TRIBUTARIA", "despesa"),
    item("DESP_OUTRAS", "despesa"),
    L("T_DESPESAS", "Total das despesas operacionais", 0, "subtotal", "despesa", despOperacionais),

    L("T_EBITDA", "7. EBITDA", 0, "total", "resultado", ebitda),

    L("T_DEPRECIACAO", "8. Depreciação e amortização", 0, "item", "despesa", depreciacao, {
      detail: detail("DEPRECIACAO"),
      notConfigured: depreciacao === 0,
    }),

    L("T_EBIT", "9. EBIT / Resultado operacional", 0, "total", "resultado", ebit),

    L("H_FINANCEIRO", "10. Resultado financeiro", 0, "header", "resultado", resultadoFinanceiro),
    item("REC_FINANCEIRA", "receita"),
    item("DESP_FINANCEIRA", "despesa"),
    L("T_FINANCEIRO", "Resultado financeiro líquido", 0, "subtotal", "resultado", resultadoFinanceiro),

    L("T_LAIR", "11. Resultado antes dos tributos sobre o lucro", 0, "total", "resultado", lair),

    L("T_IRPJ_CSLL", "12. IRPJ e CSLL", 0, "item", "despesa", tributos, {
      detail: detail("IRPJ_CSLL"),
      notConfigured: tributos === 0,
    }),

    L("T_RESULTADO_LIQUIDO", "13. Resultado líquido do período", 0, "total", "resultado", resultadoLiquido),
  ];

  const noteGroups: DreGroup[] = [
    "FORA_PESSOAL_SOCIOS",
    "FORA_ESTOQUE_ATIVO",
    "FORA_LIQUIDACAO",
    "FORA_APORTE",
    "NAO_CLASSIFICADO",
  ];
  const notes: DreLine[] = noteGroups.map((grp) =>
    L(grp, DRE_GROUP_LABEL[grp], 0, "item", "neutro", g(grp), { detail: detail(grp) }),
  );

  /* -------- detalhamento mensal -------- */
  const months = monthsBetween(from, to);
  const monthly: DreMonthlyColumn[] = months.map((mk) => {
    const raw = monthlyRaw[mk] ?? {};
    const mg = (k: string) => raw[k] ?? 0;
    const mReceita = mg("RECEITA_PRODUTOS") + mg("RECEITA_SERVICOS") + mg("RECEITA_FRETE") + mg("RECEITA_OUTRAS");
    const mDed = mg("DEDUCAO_DESCONTO") + mg("DEDUCAO_DEVOLUCAO") + mg("DEDUCAO_CANCELAMENTO") + mg("DEDUCAO_TRIBUTO");
    const mLiq = mReceita - mDed;
    const mBruto = mLiq - mg("CMV");
    const mDesp =
      mg("DESP_COMERCIAL") + mg("DESP_LOGISTICA") + mg("DESP_ADMINISTRATIVA") + mg("DESP_MANUTENCAO_TI") +
      mg("DESP_PESSOAL") + mg("DESP_OCUPACAO") + mg("DESP_TRIBUTARIA") + mg("DESP_OUTRAS");
    const mEbitda = mBruto - mDesp;
    const mEbit = mEbitda - mg("DEPRECIACAO");
    const mFin = mg("REC_FINANCEIRA") - mg("DESP_FINANCEIRA");
    const mLair = mEbit + mFin;
    return {
      key: mk,
      label: monthKeyLabel(mk),
      amountByLineKey: {
        ...raw,
        T_RECEITA_BRUTA: mReceita,
        T_DEDUCOES: mDed,
        T_RECEITA_LIQUIDA: mLiq,
        T_LUCRO_BRUTO: mBruto,
        T_DESPESAS: mDesp,
        T_EBITDA: mEbitda,
        T_DEPRECIACAO: mg("DEPRECIACAO"),
        T_EBIT: mEbit,
        T_FINANCEIRO: mFin,
        T_LAIR: mLair,
        T_IRPJ_CSLL: mg("IRPJ_CSLL"),
        T_RESULTADO_LIQUIDO: mLair - mg("IRPJ_CSLL"),
      },
    };
  });

  return {
    tenantId: input.tenantId,
    timezone: tz,
    period: input.period,
    lines,
    notes,
    margins: {
      brutaPct: pct(lucroBruto, base),
      ebitdaPct: pct(ebitda, base),
      operacionalPct: pct(ebit, base),
      liquidaPct: pct(resultadoLiquido, base),
    },
    monthly,
    unclassifiedCents: g("NAO_CLASSIFICADO"),
  };
}

/** Mapa linha → valor, usado para o comparativo. */
export function toAmountMap(r: DreResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of r.lines) out[l.key] = l.amountCents;
  for (const n of r.notes) out[n.key] = n.amountCents;
  return out;
}
