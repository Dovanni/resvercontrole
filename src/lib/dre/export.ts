/**
 * Exportação do DRE.
 *
 * PDF e Excel consomem EXATAMENTE o mesmo `DrePayload` renderizado na tela.
 * Nenhum recálculo acontece aqui — apenas formatação.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import type { DreLine, DrePayload } from "./types";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pctFmt = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

function indent(l: DreLine) {
  return (l.level === 0 ? "" : "    ") + l.label;
}

export interface ExportMeta {
  empresa: string;
  documento?: string | null;
  emitidoEm: string;
  regime: string;
}

export function exportDrePdf(payload: DrePayload, meta: ExportMeta) {
  const { current, comparison } = payload;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  doc.setFontSize(16);
  doc.text("Demonstração do Resultado do Exercício", 40, 48);
  doc.setFontSize(10);
  doc.text(meta.empresa, 40, 66);
  if (meta.documento) doc.text(meta.documento, 40, 80);
  doc.text(`Período: ${current.period.label}`, 40, meta.documento ? 94 : 80);
  doc.text(`Regime: ${meta.regime}`, 40, meta.documento ? 108 : 94);
  doc.text(`Emitido em: ${meta.emitidoEm}`, 40, meta.documento ? 122 : 108);

  const head = comparison
    ? [["Conta", "Valor", "% RL", comparison.period.label, "Variação"]]
    : [["Conta", "Valor", "% RL"]];

  const body = current.lines
    .filter((l) => l.kind !== "item" || l.amountCents !== 0)
    .map((l) => {
      const base = [indent(l), brl(l.amountCents), pctFmt(l.percentOfNetRevenue)];
      if (!comparison) return base;
      const prev = comparison.amountByLineKey[l.key] ?? 0;
      const diff = l.amountCents - prev;
      return [...base, brl(prev), brl(diff)];
    });

  autoTable(doc, {
    head,
    body,
    startY: meta.documento ? 138 : 124,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [34, 197, 94] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const line = current.lines.filter((l) => l.kind !== "item" || l.amountCents !== 0)[d.row.index];
      if (line && (line.kind === "total" || line.kind === "header")) {
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  const notes = current.notes.filter((n) => n.amountCents !== 0);
  if (notes.length) {
    autoTable(doc, {
      head: [["Notas gerenciais (fora do resultado empresarial)", "Valor"]],
      body: notes.map((n) => [n.label, brl(n.amountCents)]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [100, 116, 139] },
      columnStyles: { 1: { halign: "right" } },
    });
  }

  doc.save(`DRE_${current.period.from}_a_${current.period.to}.pdf`);
}

export function exportDreXlsx(payload: DrePayload, meta: ExportMeta) {
  const { current, comparison } = payload;
  const wb = XLSX.utils.book_new();

  const header: (string | number)[] = ["Conta", "Valor (R$)", "% Receita líquida"];
  if (comparison) header.push(`${comparison.period.label} (R$)`, "Variação (R$)", "Variação (%)");

  const rows: (string | number | null)[][] = [
    ["Demonstração do Resultado do Exercício"],
    [meta.empresa],
    ...(meta.documento ? [[meta.documento]] : []),
    [`Período: ${current.period.label}`],
    [`Regime: ${meta.regime}`],
    [`Emitido em: ${meta.emitidoEm}`],
    [],
    header,
  ];

  for (const l of current.lines) {
    const row: (string | number | null)[] = [
      indent(l),
      l.amountCents / 100,
      l.percentOfNetRevenue,
    ];
    if (comparison) {
      const prev = comparison.amountByLineKey[l.key] ?? 0;
      const diff = l.amountCents - prev;
      row.push(prev / 100, diff / 100, prev ? Math.round((diff / Math.abs(prev)) * 10000) / 100 : null);
    }
    rows.push(row);
  }

  rows.push([], ["Notas gerenciais (fora do resultado empresarial)"]);
  for (const n of current.notes) rows.push([n.label, n.amountCents / 100]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 46 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "DRE");

  if (current.monthly.length > 1) {
    const mHeader = ["Conta", ...current.monthly.map((m) => m.label)];
    const mRows: (string | number)[][] = [mHeader];
    for (const l of current.lines) {
      if (l.kind === "header") continue;
      mRows.push([indent(l), ...current.monthly.map((m) => (m.amountByLineKey[l.key] ?? 0) / 100)]);
    }
    const mws = XLSX.utils.aoa_to_sheet(mRows);
    mws["!cols"] = [{ wch: 46 }, ...current.monthly.map(() => ({ wch: 14 }))];
    XLSX.utils.book_append_sheet(wb, mws, "Mensal");
  }

  const detailRows: (string | number)[][] = [["Grupo", "Origem", "Data", "Descrição", "Valor (R$)"]];
  for (const l of [...current.lines, ...current.notes]) {
    for (const d of l.detail ?? []) {
      detailRows.push([l.label, d.source, d.date, d.label, d.amountCents / 100]);
    }
  }
  const dws = XLSX.utils.aoa_to_sheet(detailRows);
  dws["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 12 }, { wch: 56 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, dws, "Detalhamento");

  XLSX.writeFile(wb, `DRE_${current.period.from}_a_${current.period.to}.xlsx`);
}
