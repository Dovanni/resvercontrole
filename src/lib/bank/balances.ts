/**
 * Serviço canônico de saldo bancário.
 *
 * Fonte oficial (contrato atual do VEJAMAIS): a tabela `bank_movements`.
 * O saldo inicial cadastrado em `bank_accounts.initial_balance` NÃO é somado
 * novamente — ele já é materializado como um movimento de origem
 * `saldo_inicial` pelo trigger `bank_account_initial_balance_movement`.
 *
 * Regras:
 * - todos os cálculos em centavos inteiros;
 * - datas civis (YYYY-MM-DD) comparadas como texto, sem conversão UTC;
 * - intervalo [from, to] inclusivo nos dois extremos;
 * - transferência debita a conta de origem e credita a conta destino,
 *   portanto seu efeito no consolidado é zero.
 */

export type BankAccountLike = {
  id: string;
  name: string;
  bank: string;
  color?: string;
  initial_balance: number | string;
  status: string;
};

export type BankMovementLike = {
  account_id: string;
  destination_account_id: string | null;
  type: string;
  category: string;
  description: string;
  amount: number | string;
  movement_date: string;
};

export type BankAccountRow = {
  id: string;
  name: string;
  bank: string;
  status: string;
  /** Saldo no início do período (todos os movimentos anteriores a `from`). */
  openingCents: number;
  /** Entradas do período (inclui créditos recebidos por transferência). */
  inflowCents: number;
  /** Saídas do período (inclui débitos enviados por transferência). */
  outflowCents: number;
  /** Entradas − Saídas do período. */
  netCents: number;
  /** Saldo final na data "Até": Saldo inicial + Entradas − Saídas. */
  closingCents: number;
};

export type BankReport = {
  from: string;
  to: string;
  accounts: BankAccountRow[];
  totals: {
    openingCents: number;
    inflowCents: number;
    outflowCents: number;
    netCents: number;
    closingCents: number;
  };
};

export const toCents = (v: number | string) => Math.round(Number(v ?? 0) * 100);
export const fromCents = (c: number) => c / 100;

type Legs = { accountId: string; deltaCents: number; inflow: boolean }[];

/** Decompõe um movimento nas pernas que afetam cada conta. */
function legsOf(m: BankMovementLike): Legs {
  const cents = toCents(m.amount);
  if (m.type === "entrada") return [{ accountId: m.account_id, deltaCents: cents, inflow: true }];
  if (m.type === "saida") return [{ accountId: m.account_id, deltaCents: -cents, inflow: false }];
  if (m.type === "transferencia") {
    const legs: Legs = [{ accountId: m.account_id, deltaCents: -cents, inflow: false }];
    if (m.destination_account_id) {
      legs.push({ accountId: m.destination_account_id, deltaCents: cents, inflow: true });
    }
    return legs;
  }
  return [];
}

export function buildBankReport(
  accounts: BankAccountLike[],
  movements: BankMovementLike[],
  from: string,
  to: string,
): BankReport {
  const rows = new Map<string, BankAccountRow>();
  for (const a of accounts) {
    rows.set(a.id, {
      id: a.id,
      name: a.name,
      bank: a.bank,
      status: a.status,
      openingCents: 0,
      inflowCents: 0,
      outflowCents: 0,
      netCents: 0,
      closingCents: 0,
    });
  }

  for (const m of movements) {
    const d = m.movement_date?.slice(0, 10);
    if (!d || d > to) continue; // fora da janela do relatório
    const before = d < from;
    for (const leg of legsOf(m)) {
      const row = rows.get(leg.accountId);
      if (!row) continue; // movimento sem conta conhecida — não entra no relatório
      if (before) {
        row.openingCents += leg.deltaCents;
      } else if (leg.inflow) {
        row.inflowCents += leg.deltaCents;
      } else {
        row.outflowCents += -leg.deltaCents;
      }
    }
  }

  const list = [...rows.values()]
    .map((r) => ({
      ...r,
      netCents: r.inflowCents - r.outflowCents,
      closingCents: r.openingCents + r.inflowCents - r.outflowCents,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const totals = list.reduce(
    (acc, r) => ({
      openingCents: acc.openingCents + r.openingCents,
      inflowCents: acc.inflowCents + r.inflowCents,
      outflowCents: acc.outflowCents + r.outflowCents,
      netCents: acc.netCents + r.netCents,
      closingCents: acc.closingCents + r.closingCents,
    }),
    { openingCents: 0, inflowCents: 0, outflowCents: 0, netCents: 0, closingCents: 0 },
  );

  return { from, to, accounts: list, totals };
}

/**
 * Saldo atual por conta (mesma fórmula do relatório, sem recorte de período).
 * Usado pela tela de Contas bancárias para que os dois lugares compartilhem
 * exatamente a mesma autoridade de saldo.
 */
export function currentBalancesCents(
  accounts: BankAccountLike[],
  movements: BankMovementLike[],
): Record<string, number> {
  const report = buildBankReport(accounts, movements, "0000-01-01", "9999-12-31");
  return Object.fromEntries(report.accounts.map((a) => [a.id, a.closingCents]));
}
