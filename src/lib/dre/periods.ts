/**
 * Datas civis do DRE.
 *
 * Todo o DRE opera em DATAS CIVIS (YYYY-MM-DD) no timezone da empresa.
 * Nunca convertemos uma data civil para UTC e de volta — isso é exatamente
 * o que fazia lançamentos de julho aparecerem em junho.
 */

import { DEFAULT_TIMEZONE, type DrePeriod, type PeriodPreset } from "./types";

/** Converte um timestamptz ISO para a data civil (YYYY-MM-DD) no timezone informado. */
export function civilDateInTz(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso));
}

/** Data civil de "hoje" no timezone da empresa. */
export function todayInTz(timezone: string = DEFAULT_TIMEZONE): string {
  return civilDateInTz(new Date().toISOString(), timezone);
}

/** Aritmética de datas civis sem qualquer conversão de fuso (usa UTC puro como calendário). */
function toParts(d: string): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
}

function fromParts(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

export function addMonthsCivil(date: string, months: number): string {
  const [y, m, d] = toParts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return fromParts(ny, nm, Math.min(d, lastDay));
}

export function addDaysCivil(date: string, days: number): string {
  const [y, m, d] = toParts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function startOfMonth(date: string): string {
  const [y, m] = toParts(date);
  return fromParts(y, m, 1);
}

export function endOfMonth(date: string): string {
  const [y, m] = toParts(date);
  return fromParts(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthKeyLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatCivil(date: string): string {
  const [y, m, d] = toParts(date);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function periodLabel(from: string, to: string): string {
  return `${formatCivil(from)} a ${formatCivil(to)}`;
}

/** Lista de meses (YYYY-MM) cobertos pelo período, inclusivo. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  const end = startOfMonth(to);
  while (cur <= end) {
    out.push(monthKey(cur));
    cur = addMonthsCivil(cur, 1);
  }
  return out;
}

/** Resolve um preset de período em datas civis inclusivas. */
export function resolvePreset(
  preset: PeriodPreset,
  timezone: string = DEFAULT_TIMEZONE,
  custom?: { from: string; to: string },
): DrePeriod {
  const today = todayInTz(timezone);
  const [y, m] = toParts(today);

  const build = (from: string, to: string): DrePeriod => ({
    from,
    to,
    label: periodLabel(from, to),
  });

  switch (preset) {
    // MTD — Month to Date: nunca projeta dias futuros do mês corrente.
    case "mes_atual":
      return build(startOfMonth(today), today);
    case "mes_completo":
      return build(startOfMonth(today), endOfMonth(today));
    case "mes_anterior": {
      const prev = addMonthsCivil(startOfMonth(today), -1);
      return build(prev, endOfMonth(prev));
    }
    case "trimestre_atual": {
      const q = Math.floor((m - 1) / 3);
      const s = fromParts(y, q * 3 + 1, 1);
      return build(s, endOfMonth(addMonthsCivil(s, 2)));
    }
    case "trimestre_anterior": {
      const q = Math.floor((m - 1) / 3);
      const s = addMonthsCivil(fromParts(y, q * 3 + 1, 1), -3);
      return build(s, endOfMonth(addMonthsCivil(s, 2)));
    }
    case "semestre_atual": {
      const s = fromParts(y, m <= 6 ? 1 : 7, 1);
      return build(s, endOfMonth(addMonthsCivil(s, 5)));
    }
    case "semestre_anterior": {
      const s = addMonthsCivil(fromParts(y, m <= 6 ? 1 : 7, 1), -6);
      return build(s, endOfMonth(addMonthsCivil(s, 5)));
    }
    case "ano_atual":
      return build(fromParts(y, 1, 1), fromParts(y, 12, 31));
    case "ano_anterior":
      return build(fromParts(y - 1, 1, 1), fromParts(y - 1, 12, 31));
    case "acumulado_ano":
      return build(fromParts(y, 1, 1), today);
    case "ultimos_12_meses": {
      const s = startOfMonth(addMonthsCivil(today, -11));
      return build(s, today);
    }
    case "personalizado":
    default: {
      const from = custom?.from ?? startOfMonth(today);
      const to = custom?.to ?? today;
      return build(from <= to ? from : to, from <= to ? to : from);
    }
  }
}

/** Período imediatamente anterior, com a mesma quantidade de dias. */
export function previousPeriod(p: DrePeriod): DrePeriod {
  const days =
    (Date.parse(p.to + "T00:00:00Z") - Date.parse(p.from + "T00:00:00Z")) / 86_400_000 + 1;
  const to = addDaysCivil(p.from, -1);
  const from = addDaysCivil(to, -(days - 1));
  return { from, to, label: periodLabel(from, to) };
}

/** Mesmo período do ano anterior. */
export function lastYearPeriod(p: DrePeriod): DrePeriod {
  const from = addMonthsCivil(p.from, -12);
  const to = addMonthsCivil(p.to, -12);
  return { from, to, label: periodLabel(from, to) };
}
