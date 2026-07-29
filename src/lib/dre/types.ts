/**
 * DRE Tradicional Gerencial por Competência — contratos canônicos.
 *
 * Regra de ouro: tela, PDF e XLSX consomem EXATAMENTE o mesmo `DreResult`
 * produzido por `computeDre`. Nenhuma superfície recalcula nada.
 */

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Grupos canônicos do DRE. Espelham o CHECK constraint das tabelas de classificação. */
export type DreGroup =
  | "RECEITA_PRODUTOS"
  | "RECEITA_SERVICOS"
  | "RECEITA_FRETE"
  | "RECEITA_OUTRAS"
  | "DEDUCAO_DESCONTO"
  | "DEDUCAO_DEVOLUCAO"
  | "DEDUCAO_CANCELAMENTO"
  | "DEDUCAO_TRIBUTO"
  | "CMV"
  | "DESP_COMERCIAL"
  | "DESP_LOGISTICA"
  | "DESP_ADMINISTRATIVA"
  | "DESP_MANUTENCAO_TI"
  | "DESP_PESSOAL"
  | "DESP_OCUPACAO"
  | "DESP_TRIBUTARIA"
  | "DESP_OUTRAS"
  | "DEPRECIACAO"
  | "REC_FINANCEIRA"
  | "DESP_FINANCEIRA"
  | "IRPJ_CSLL"
  | "FORA_PESSOAL_SOCIOS"
  | "FORA_ESTOQUE_ATIVO"
  | "FORA_LIQUIDACAO"
  | "FORA_APORTE"
  | "NAO_CLASSIFICADO";

export const DRE_GROUP_LABEL: Record<DreGroup, string> = {
  RECEITA_PRODUTOS: "Vendas de produtos",
  RECEITA_SERVICOS: "Serviços prestados",
  RECEITA_FRETE: "Frete cobrado do cliente",
  RECEITA_OUTRAS: "Outras receitas operacionais",
  DEDUCAO_DESCONTO: "Descontos concedidos",
  DEDUCAO_DEVOLUCAO: "Devoluções",
  DEDUCAO_CANCELAMENTO: "Cancelamentos",
  DEDUCAO_TRIBUTO: "Tributos sobre vendas",
  CMV: "CMV / CPV / CSP",
  DESP_COMERCIAL: "Despesas comerciais e de vendas",
  DESP_LOGISTICA: "Logística e fretes da empresa",
  DESP_ADMINISTRATIVA: "Despesas administrativas",
  DESP_MANUTENCAO_TI: "Manutenção e tecnologia",
  DESP_PESSOAL: "Pessoal",
  DESP_OCUPACAO: "Ocupação",
  DESP_TRIBUTARIA: "Despesas tributárias operacionais",
  DESP_OUTRAS: "Outras despesas operacionais",
  DEPRECIACAO: "Depreciação e amortização",
  REC_FINANCEIRA: "Receitas financeiras",
  DESP_FINANCEIRA: "Despesas financeiras",
  IRPJ_CSLL: "IRPJ e CSLL",
  FORA_PESSOAL_SOCIOS: "Retiradas e despesas pessoais dos sócios",
  FORA_ESTOQUE_ATIVO: "Compras de estoque / ativo",
  FORA_LIQUIDACAO: "Pagamentos de faturas e liquidações financeiras",
  FORA_APORTE: "Aportes e recursos dos sócios",
  NAO_CLASSIFICADO: "Itens a classificar",
};

/** Natureza da linha: define se uma variação positiva é favorável. */
export type LineNature = "receita" | "despesa" | "resultado" | "neutro";

export type LineKind = "header" | "item" | "subtotal" | "total";

export interface DreDetailRow {
  id: string;
  source: string;
  date: string;
  label: string;
  amountCents: number;
}

export interface DreLine {
  key: string;
  label: string;
  level: 0 | 1 | 2;
  kind: LineKind;
  nature: LineNature;
  amountCents: number;
  /** Percentual sobre a receita operacional líquida (null quando não aplicável). */
  percentOfNetRevenue: number | null;
  /** Verdadeiro quando a linha não possui fonte de dados configurada. */
  notConfigured?: boolean;
  detail?: DreDetailRow[];
}

export interface DrePeriod {
  from: string; // YYYY-MM-DD civil, inclusivo
  to: string; // YYYY-MM-DD civil, inclusivo
  label: string;
}

export interface DreMonthlyColumn {
  key: string; // YYYY-MM
  label: string;
  amountByLineKey: Record<string, number>;
}

export interface DreResult {
  tenantId: string;
  timezone: string;
  period: DrePeriod;
  lines: DreLine[];
  /** Notas gerenciais — fora do resultado empresarial. */
  notes: DreLine[];
  margins: {
    brutaPct: number | null;
    ebitdaPct: number | null;
    operacionalPct: number | null;
    liquidaPct: number | null;
  };
  monthly: DreMonthlyColumn[];
  unclassifiedCents: number;
}

export interface DreComparison {
  period: DrePeriod;
  amountByLineKey: Record<string, number>;
}

export interface DrePayload {
  current: DreResult;
  comparison: DreComparison | null;
  comparisonMode: ComparisonMode;
}

export type ComparisonMode = "none" | "previous" | "last_year";

export type PeriodPreset =
  | "mes_atual"
  | "mes_anterior"
  | "trimestre_atual"
  | "trimestre_anterior"
  | "semestre_atual"
  | "semestre_anterior"
  | "ano_atual"
  | "ano_anterior"
  | "acumulado_ano"
  | "ultimos_12_meses"
  | "personalizado";

export const PERIOD_PRESET_LABEL: Record<PeriodPreset, string> = {
  mes_atual: "Mês atual",
  mes_anterior: "Mês anterior",
  trimestre_atual: "Trimestre atual",
  trimestre_anterior: "Trimestre anterior",
  semestre_atual: "Semestre atual",
  semestre_anterior: "Semestre anterior",
  ano_atual: "Ano atual",
  ano_anterior: "Ano anterior",
  acumulado_ano: "Acumulado do ano",
  ultimos_12_meses: "Últimos 12 meses",
  personalizado: "Período personalizado",
};
