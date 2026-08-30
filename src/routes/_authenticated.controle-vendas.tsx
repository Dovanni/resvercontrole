import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, Pencil, Trash2, Save, Eraser, Lock, LockOpen, History, ChevronDown, ChevronUp, Eye, Search, Link2, HelpCircle, ScanSearch } from "lucide-react";
import { AuditoriaLucroDialog } from "@/components/auditoria-lucro-dialog";
// jspdf and jspdf-autotable are lazy-loaded inside exportPdfAnual to avoid bundling them on initial page load
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/controle-vendas")({
  head: () => ({ meta: [{ title: "Controle de Vendas — Vejamais" }] }),
  component: ControleVendasPage,
});

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const YEAR = 2026;

type Row = {
  id: string;
  data: string;
  mes: number;
  ano: number;
  loja: number;
  custo: number;
  juros_ml: number;
  frete_empresa: number;
  frete_cliente: number;
  receber: number;
  rateio: number;
  lucro: number;
  origem?: string | null;
  sale_id?: string | null;
  sales?: { customer_name: string | null; customers?: { name: string | null } | null } | null;
};

const emptyForm = () => ({
  id: "" as string,
  data: new Date().toISOString().slice(0, 10),
  loja: "",
  custo: "",
  juros_ml: "",
  frete_empresa: "",
  frete_cliente: "",
});

const num = (s: string) => {
  const n = parseFloat(String(s).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

// Fórmulas oficiais (definitivas):
// RECEBER = LOJA (fixo; o frete cobrado do cliente já compõe o total recebido da venda)
// LUCRO   = RECEBER - CUSTO - JUROS_ML - FRETE_EMPRESA
// MARGEM  = LUCRO / RECEBER * 100
// RATEIO (mensal) = TOTAL_FORNECEDOR - SUM(CUSTO)
const calcReceber = (loja: number) => loja;
const calcLucro = (loja: number, custo: number, freteEmp: number, juros: number, _freteCli: number) =>
  loja - custo - juros - freteEmp;
const calcMargem = (lucro: number, receber: number) => {
  return receber > 0 ? (lucro * 100) / receber : 0;
};

function ControleVendasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const { empresaId, isEnabled } = useMultiempresa();
  const [form, setForm] = useState(emptyForm());
  const [fornecedorInput, setFornecedorInput] = useState("");
  const [editingFornecedor, setEditingFornecedor] = useState(false);
  const [motivoAlteracao, setMotivoAlteracao] = useState("");
  const [showHistorico, setShowHistorico] = useState(false);
  const [vendaSearch, setVendaSearch] = useState("");
  const [vendaCanal, setVendaCanal] = useState<string>("todos");
  const [vendaStatus, setVendaStatus] = useState<string>("todos");
  const [vendaDetalheId, setVendaDetalheId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [auditoriaId, setAuditoriaId] = useState<string | null>(null);

  const { data: vendasMes = [] } = useQuery({
    queryKey: ["controle-vendas-pedidos", YEAR, mes, empresaId],
    queryFn: async () => {
      const mm = String(mes).padStart(2, "0");
      const nextMes = mes === 12 ? 1 : mes + 1;
      const nextAno = mes === 12 ? YEAR + 1 : YEAR;
      const nmm = String(nextMes).padStart(2, "0");
      const ini = `${YEAR}-${mm}-01T00:00:00`;
      const fim = `${nextAno}-${nmm}-01T00:00:00`;
      let q = supabase
        .from("sales")
        .select("id, sold_at, customer_name, customer_id, channel, payment_method, total, discount, status, bank_account_id, notes, customers(name), bank_accounts(name, bank), sale_items(quantity, unit_price, unit_cost, products(name))")
        .gte("sold_at", ini)
        .lt("sold_at", fim)
        .neq("channel", "recursos_financeiros")
        .neq("status", "cancelado");
      
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      
      const { data, error } = await q.order("sold_at", { ascending: false });
      if (error) {
        console.error("[controle-vendas-pedidos] erro:", error);
        throw error;
      }
      return (data ?? []) as any[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["controle-vendas", YEAR, mes, empresaId],
    queryFn: async () => {
      let q = supabase
        .from("controle_vendas_diario")
        .select("*, sales:sale_id(customer_name, customers:customer_id(name))")
        .eq("ano", YEAR)
        .eq("mes", mes);
      
      if (isEnabled && empresaId) q = q.eq("empresa_id", empresaId);
      
      const { data, error } = await q.order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: fornecedorRow } = useQuery({
    queryKey: ["controle-vendas-fornecedor", YEAR, mes, empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("controle_vendas_fornecedor") as any)
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ano", YEAR)
        .eq("mes", mes)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; empresa_id: string; valor_fornecedor: number } | null;
    },
  });

  useEffect(() => {
    setFornecedorInput(fornecedorRow ? String(fornecedorRow.valor_fornecedor) : "");
  }, [fornecedorRow]);

  // Prévia em tempo real
  const preview = useMemo(() => {
    const loja = num(form.loja);
    const custo = num(form.custo);
    const juros = num(form.juros_ml);
    const frete_emp = num(form.frete_empresa);
    const frete_cli = num(form.frete_cliente);
    const receber = calcReceber(loja);
    const lucro = calcLucro(loja, custo, frete_emp, juros, frete_cli);
    const margem = calcMargem(lucro, receber);
    return { receber, lucro, margem };
  }, [form]);

  const totals = useMemo(() => {
    const sum = (k: keyof Row) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    return {
      loja: sum("loja"),
      custo: sum("custo"),
      juros_ml: sum("juros_ml"),
      frete_empresa: sum("frete_empresa"),
      frete_cliente: sum("frete_cliente"),
      receber: sum("receber"),
      lucro: sum("lucro"),
    };
  }, [rows]);

  // Fornecedor (negativo) + saldo acumulado por linha (data ascendente)
  const fornecedor = useMemo(() => -Math.abs(num(fornecedorInput)), [fornecedorInput]);
  const rowsWithSaldo = useMemo(() => {
    let acc = fornecedor;
    return rows.map((r) => {
      acc = acc + Number(r.custo ?? 0);
      return { ...r, saldo_acumulado: acc };
    });
  }, [rows, fornecedor]);

  const summary = useMemo(() => {
    const investimento = totals.custo + totals.juros_ml + totals.frete_empresa;
    const rateio = fornecedor + totals.custo;
    const saldo = rateio;
    const saldoAtual = rowsWithSaldo.length > 0
      ? rowsWithSaldo[rowsWithSaldo.length - 1].saldo_acumulado
      : fornecedor;
    const quitado = saldoAtual >= 0 && fornecedor < 0;
    const margem = calcMargem(totals.lucro, totals.receber);
    return { receber: totals.receber, lucro: totals.lucro, margem, rateio, fornecedor, investimento, custo: totals.custo, saldo, saldoAtual, quitado };
  }, [totals, fornecedor, rowsWithSaldo]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("Sem usuário");
      const d = new Date(form.data + "T00:00:00");
      const payload: any = {
        user_id,
        empresa_id: empresaId!,
        data: form.data,
        mes: d.getMonth() + 1,
        ano: d.getFullYear(),
        loja: num(form.loja),
        custo: num(form.custo),
        juros_ml: num(form.juros_ml),
        frete_empresa: num(form.frete_empresa),
        frete_cliente: num(form.frete_cliente),
        receber: preview.receber,
        rateio: 0,
        lucro: preview.lucro,
      };
      if (form.id) {
        const { error } = await supabase.from("controle_vendas_diario").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("controle_vendas_diario").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Lançamento salvo");
      setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["controle-vendas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["controle-vendas-fornecedor-historico", YEAR, mes, empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("controle_vendas_fornecedor_historico") as any)
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ano", YEAR)
        .eq("mes", mes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; valor_anterior: number; valor_novo: number;
        motivo: string | null; created_at: string;
      }>;
    },
  });

  const saveFornecedor = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("Sem usuário");
      if (!empresaId) throw new Error("Empresa não selecionada");
      const novoValor = num(fornecedorInput);
      const valorAnterior = Number(fornecedorRow?.valor_fornecedor ?? 0);
      const isEdit = editingFornecedor && fornecedorRow && novoValor !== valorAnterior;

      const payload = { user_id, empresa_id: empresaId, mes, ano: YEAR, valor_fornecedor: novoValor };
      const { error } = await (supabase
        .from("controle_vendas_fornecedor") as any)
        .upsert(payload, { onConflict: "empresa_id,mes,ano" });
      if (error) throw error;

      if (isEdit) {
        const { error: hErr } = await (supabase
          .from("controle_vendas_fornecedor_historico") as any)
          .insert({
            user_id, empresa_id: empresaId, mes, ano: YEAR,
            valor_anterior: valorAnterior,
            valor_novo: novoValor,
            motivo: motivoAlteracao || null,
          });
        if (hErr) throw hErr;
      }
    },
    onSuccess: () => {
      toast.success("Fornecedor do mês salvo");
      setEditingFornecedor(false);
      setMotivoAlteracao("");
      qc.invalidateQueries({ queryKey: ["controle-vendas-fornecedor"] });
      qc.invalidateQueries({ queryKey: ["controle-vendas-fornecedor-historico"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("controle_vendas_diario").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      qc.invalidateQueries({ queryKey: ["controle-vendas"] });
    },
  });

  const onEdit = (r: Row) => {
    if (r.origem === "venda_automatica") {
      if (r.sale_id) {
        navigate({ to: "/vendas", search: { edit: r.sale_id } as any });
      } else {
        toast.info("Lançamento gerado de uma venda. Edite na tela Vendas.");
      }
      return;
    }
    setForm({
      id: r.id,
      data: r.data,
      loja: String(r.loja),
      custo: String(r.custo),
      juros_ml: String(r.juros_ml),
      frete_empresa: String(r.frete_empresa),
      frete_cliente: String(r.frete_cliente),
    });
  };

  const onDelete = async (r: Row) => {
    const auto = r.origem === "venda_automatica";
    const ok = await confirm({
      title: "Excluir lançamento?",
      description: auto
        ? `Esta linha foi gerada automaticamente da venda de ${r.sales?.customers?.name ?? r.sales?.customer_name ?? "cliente"}. Se a venda for editada novamente, o lançamento será recriado. Excluir mesmo assim?`
        : `Lançamento de ${new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")} será removido.`,
      confirmText: "Excluir",
    });
    if (ok) del.mutate(r.id);
  };

  const exportXlsx = () => {
    const aoa: any[][] = [
      ["Data", "Dia", "Loja", "Custo", "Juros ML", "Frete Emp", "Frete Cli", "Receber", "Lucro"],
    ];
    rows.forEach((r) => {
      const d = new Date(r.data + "T00:00:00");
      aoa.push([
        d.toLocaleDateString("pt-BR"),
        WEEKDAYS[d.getDay()],
        r.loja, r.custo, r.juros_ml, r.frete_empresa, r.frete_cliente, r.receber, r.lucro,
      ]);
    });
    aoa.push([
      "TOTAL", "",
      totals.loja, totals.custo, totals.juros_ml, totals.frete_empresa, totals.frete_cliente, totals.receber, totals.lucro,
    ]);
    aoa.push([]);
    aoa.push(["Resumo do mês"]);
    aoa.push(["Receber", summary.receber]);
    aoa.push(["Lucro", summary.lucro]);
    aoa.push(["Margem %", Number(summary.margem.toFixed(2))]);
    aoa.push(["Rateio", summary.rateio]);
    aoa.push(["Fornecedor", summary.fornecedor]);
    aoa.push(["Investimento", summary.investimento]);
    aoa.push(["Saldo", summary.saldo]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, MONTHS[mes - 1]);
    XLSX.writeFile(wb, `controle_vendas_${MONTH_SHORT[mes - 1]}_${YEAR}.xlsx`);
  };

  const exportPdfAnual = async () => {
    const ano = YEAR;
    try {
      if (!empresaId) throw new Error("Empresa não selecionada");
      const [diarioRes, fornRes] = await Promise.all([
        supabase.from("controle_vendas_diario").select("mes,receber,lucro,custo,frete_empresa").eq("ano", ano).eq("empresa_id", empresaId),
        (supabase.from("controle_vendas_fornecedor") as any).select("mes,valor_fornecedor").eq("ano", ano).eq("empresa_id", empresaId),
      ]);
      if (diarioRes.error) throw diarioRes.error;
      if (fornRes.error) throw fornRes.error;

      const fornByMes = new Map<number, number>();
      (fornRes.data ?? []).forEach((f: any) => fornByMes.set(f.mes, Number(f.valor_fornecedor ?? 0)));

      const monthly = Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        receber: 0,
        lucro: 0,
        custo: 0,
        frete_empresa: 0,
        fornecedor: 0,
        rateio: 0,
        saldo: 0,
        margem: 0,
        hasData: false,
      }));
      (diarioRes.data ?? []).forEach((r: any) => {
        const m = monthly[r.mes - 1];
        m.receber += Number(r.receber ?? 0);
        m.lucro += Number(r.lucro ?? 0);
        m.custo += Number(r.custo ?? 0);
        m.frete_empresa += Number(r.frete_empresa ?? 0);
        m.hasData = true;
      });
      monthly.forEach((m) => {
        const forn = fornByMes.get(m.mes);
        if (forn !== undefined) {
          m.fornecedor = -Math.abs(forn);
          m.hasData = true;
        }
        m.rateio = m.fornecedor + m.custo;
        m.saldo = m.rateio;
        m.margem = m.receber > 0 ? (m.lucro * 100) / m.receber : 0;
      });

      const totals = monthly.reduce(
        (a, m) => ({
          receber: a.receber + m.receber,
          lucro: a.lucro + m.lucro,
          custo: a.custo + m.custo,
          frete_empresa: a.frete_empresa + m.frete_empresa,
          fornecedor: a.fornecedor + m.fornecedor,
          rateio: a.rateio + m.rateio,
          saldo: a.saldo + m.saldo,
        }),
        { receber: 0, lucro: 0, custo: 0, frete_empresa: 0, fornecedor: 0, rateio: 0, saldo: 0 },
      );
      const margemTotal = totals.receber > 0 ? (totals.lucro * 100) / totals.receber : 0;

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const dash = "—";

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ANGELA MARIA MOMO RODRIGUES MEI", pageW / 2, 14, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("CNPJ: 33.613.716/0001-13", pageW / 2, 20, { align: "center" });
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Controle de Vendas — Anual ${ano}`, pageW / 2, 27, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const geradoEm = new Date().toLocaleString("pt-BR");
      doc.text(`Gerado em ${geradoEm}`, pageW / 2, 32, { align: "center" });

      const fmt = (n: number, m: { hasData: boolean }, _col: string) => {
        if (!m.hasData) return dash;
        return brl(n);
      };

      const body = monthly.map((m) => [
        MONTHS[m.mes - 1],
        m.hasData ? brl(m.receber) : dash,
        m.hasData ? brl(m.lucro) : dash,
        m.hasData ? `${m.margem.toFixed(1)}%` : dash,
        m.hasData ? brl(m.custo) : dash,
        m.hasData ? brl(m.fornecedor) : dash,
        m.hasData ? brl(m.rateio) : dash,
        m.hasData ? brl(m.saldo) : dash,
      ]);

      body.push([
        "TOTAL ANO",
        brl(totals.receber),
        brl(totals.lucro),
        `${margemTotal.toFixed(1)}%`,
        brl(totals.custo),
        brl(totals.fornecedor),
        brl(totals.rateio),
        brl(totals.saldo),
      ]);

      const negativeCols = new Set([5, 6, 7]); // Fornecedor, Rateio, Saldo
      const positiveCols = new Set([1, 2, 4]); // Receber, Lucro, Custo
      const margemCol = 3;

      autoTable(doc, {
        startY: 38,
        head: [["Mês", "Receber", "Lucro", "Margem", "Custo", "Fornecedor", "Rateio", "Saldo"]],
        body,
        styles: { fontSize: 9, halign: "right" },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, halign: "center" },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        didParseCell: (data: any) => {
          const isTotal = data.row.index === 12 && data.section === "body";
          const m = data.section === "body" && data.row.index < 12 ? monthly[data.row.index] : null;
          const noData = m && !m.hasData;

          if (isTotal) {
            data.cell.styles.fillColor = [220, 220, 220];
            data.cell.styles.fontStyle = "bold";
          }
          if (data.section === "body" && data.column.index > 0) {
            if (noData) {
              data.cell.styles.textColor = [170, 170, 170];
            } else if (negativeCols.has(data.column.index)) {
              data.cell.styles.textColor = [200, 30, 30];
            } else if (positiveCols.has(data.column.index)) {
              data.cell.styles.textColor = [20, 120, 50];
            } else if (data.column.index === margemCol) {
              data.cell.styles.textColor = [30, 80, 190];
            }
          }
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY ?? 38;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Gerado em ${geradoEm} pelo Vejamais`,
        pageW / 2,
        Math.min(finalY + 10, doc.internal.pageSize.getHeight() - 8),
        { align: "center" },
      );

      doc.save(`controle_vendas_anual_${ano}.pdf`);
      toast.success("PDF anual gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Vendas"
        subtitle="Lançamento diário e resumo mensal"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)} className="text-muted-foreground hover:text-primary">
              <HelpCircle className="size-4 mr-1" /> Como funciona
            </Button>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m} / {YEAR}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportXlsx}>
              <FileSpreadsheet className="size-4 mr-2" /> Exportar Excel
            </Button>
            <Button variant="outline" onClick={exportPdfAnual}>
              <FileText className="size-4 mr-2" /> Exportar PDF Anual
            </Button>
          </div>
        }
      />

      <HelpDialog open={showHelp} onOpenChange={setShowHelp} />


      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        <SummaryCard label="Receber" value={brl(summary.receber)} tone="positive" />
        <SummaryCard label="Lucro" value={brl(summary.lucro)} tone="positive" />
        <SummaryCard label="Margem" value={`${summary.margem.toFixed(1)}%`} tone="info" />
        <SummaryCard label="Custo" value={brl(summary.custo)} tone="positive" />
        <SummaryCard label="Fornecedor" value={brl(summary.fornecedor)} tone="negative" />
        <SummaryCard label="Rateio" value={brl(summary.rateio)} tone="negative" />
        <SummaryCard label="Saldo" value={brl(summary.saldo)} tone="negative" />
        <SummaryCard
          label={summary.quitado ? "Saldo atual ✅ Quitado!" : "Saldo atual"}
          value={brl(summary.saldoAtual)}
          tone={summary.saldoAtual < 0 ? "negative" : summary.saldoAtual > 0 ? "positive" : "neutral"}
        />
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-display text-lg">{form.id ? "Editar lançamento" : "Novo lançamento"}</h3>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
            <Field label={`Data ${form.data ? `(${WEEKDAYS[new Date(form.data + "T00:00:00").getDay()]})` : ""}`}>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </Field>
            <Field label="Loja (R$)"><Input inputMode="decimal" value={form.loja} onChange={(e) => setForm({ ...form, loja: e.target.value })} /></Field>
            <Field label="Custo (R$)"><Input inputMode="decimal" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} /></Field>
            <Field label="Juros ML (R$)"><Input inputMode="decimal" value={form.juros_ml} onChange={(e) => setForm({ ...form, juros_ml: e.target.value })} /></Field>
            <Field label="Frete empresa (R$)"><Input inputMode="decimal" value={form.frete_empresa} onChange={(e) => setForm({ ...form, frete_empresa: e.target.value })} /></Field>
            <Field label="Frete cliente (R$)"><Input inputMode="decimal" value={form.frete_cliente} onChange={(e) => setForm({ ...form, frete_cliente: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3 text-sm">
            <PreviewBox label="A receber (prévia)" value={brl(preview.receber)} tone={preview.receber >= 0 ? "positive" : "negative"} />
            <PreviewBox label="Lucro (prévia)" value={brl(preview.lucro)} tone={preview.lucro >= 0 ? "positive" : "negative"} />
            <PreviewBox label="Margem (prévia)" value={`${preview.margem.toFixed(1)}%`} tone={preview.lucro >= 0 ? "positive" : "negative"} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setForm(emptyForm())}><Eraser className="size-4 mr-2" /> Limpar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="size-4 mr-2" /> {form.id ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fornecedor do mês */}
      {(() => {
        const hoje = new Date();
        const diaAtual = hoje.getDate();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();
        let locked = false;
        if (YEAR < anoAtual) locked = true;
        else if (YEAR === anoAtual) {
          if (mes < mesAtual) locked = true;
          else if (mes === mesAtual && diaAtual > 1) locked = true;
        }
        const proxMesIdx = mes === 12 ? 0 : mes;
        const proxMesNome = MONTHS[proxMesIdx];
        const proxAno = mes === 12 ? YEAR + 1 : YEAR;
        const isReadonly = locked && !editingFornecedor;
        const showSaveBtn = !locked || editingFornecedor;
        const handleRequestEdit = async () => {
          const ok = await confirm({
            title: "Editar valor do fornecedor?",
            description: `Deseja alterar o valor do fornecedor de ${MONTHS[mes - 1]}/${YEAR}? Isso indica uma renegociação com o fornecedor.`,
            confirmText: "Sim, editar",
            cancelText: "Cancelar",
            destructive: false,
          });
          if (ok) setEditingFornecedor(true);
        };
        return (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <Label className="flex items-center gap-1.5">
                  {isReadonly ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                  Total devido a fornecedores em {MONTHS[mes - 1]}/{YEAR}
                </Label>
                <div className="flex gap-2 items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          inputMode="decimal"
                          value={fornecedorInput}
                          onChange={(e) => setFornecedorInput(e.target.value)}
                          placeholder="0,00"
                          readOnly={isReadonly}
                          className={cn(isReadonly && "bg-muted cursor-not-allowed")}
                        />
                      </TooltipTrigger>
                      {isReadonly && (
                        <TooltipContent>
                          Este valor só pode ser alterado no primeiro dia do próximo mês — use "Editar" para renegociações
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  {locked && !editingFornecedor && (
                    <Button variant="outline" size="sm" onClick={handleRequestEdit}>
                      <Pencil className="size-4 mr-1" /> Editar
                    </Button>
                  )}
                </div>
                {isReadonly && (
                  <p className="text-xs text-muted-foreground mt-1">
                    🔒 Bloqueado até 01/{proxMesNome}/{proxAno}
                  </p>
                )}
                {editingFornecedor && (
                  <div className="mt-2 space-y-1">
                    <Label className="text-xs">Motivo da alteração (opcional)</Label>
                    <Textarea
                      value={motivoAlteracao}
                      onChange={(e) => setMotivoAlteracao(e.target.value)}
                      placeholder="Ex: Renegociação, Desconto obtido, Erro de lançamento"
                      rows={2}
                    />
                  </div>
                )}
                {historico.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowHistorico((v) => !v)}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <History className="size-3" />
                      Ver histórico de alterações ({historico.length})
                      {showHistorico ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                    {showHistorico && (
                      <ul className="mt-2 space-y-1.5 text-xs border-l-2 border-muted pl-3">
                        {historico.map((h) => (
                          <li key={h.id} className="space-y-0.5">
                            <div className="text-muted-foreground">
                              {new Date(h.created_at).toLocaleString("pt-BR")}
                            </div>
                            <div>
                              <span className="text-destructive line-through">{brl(h.valor_anterior)}</span>
                              {" → "}
                              <span className="font-medium">{brl(h.valor_novo)}</span>
                            </div>
                            {h.motivo && <div className="text-muted-foreground italic">"{h.motivo}"</div>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {showSaveBtn && (
                <div className="flex gap-2">
                  {editingFornecedor && (
                    <Button variant="outline" onClick={() => {
                      setEditingFornecedor(false);
                      setMotivoAlteracao("");
                      setFornecedorInput(fornecedorRow ? String(fornecedorRow.valor_fornecedor) : "");
                    }}>
                      Cancelar
                    </Button>
                  )}
                  <Button onClick={() => saveFornecedor.mutate()} disabled={saveFornecedor.isPending}>
                    <Save className="size-4 mr-2" /> {editingFornecedor ? "Salvar alteração" : "Salvar fornecedor"}
                  </Button>
                </div>
              )}
            </div>
            {!locked && num(fornecedorInput) <= 0 && (
              <div className="text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2">
                ⚠️ Preencha o total de fornecedores para calcular o Rateio e o Saldo corretamente
              </div>
            )}
          </CardContent>
        </Card>
        );
      })()}

      {/* Table */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Data</th>
                <th className="p-2">Dia</th>
                <th className="p-2 text-right">Loja</th>
                <th className="p-2 text-right">Custo</th>
                <th className="p-2 text-right">Juros ML</th>
                <th className="p-2 text-right">Frete Emp</th>
                <th className="p-2 text-right">Frete Cli</th>
                <th className="p-2 text-right">Receber</th>
                <th className="p-2 text-right">Lucro</th>
                <th className="p-2 text-right">Saldo</th>
                <th className="p-2 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithSaldo.length === 0 && (
                <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Nenhum lançamento neste mês.</td></tr>
              )}
              {rowsWithSaldo.map((r) => {
                const d = new Date(r.data + "T00:00:00");
                const dow = d.getDay();
                const weekend = dow === 0 || dow === 6;
                const auto = r.origem === "venda_automatica";
                const clienteNome = r.sales?.customers?.name ?? r.sales?.customer_name ?? "";
                return (
                  <tr key={r.id} className={cn("border-b", weekend && "bg-primary/10")}>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        {d.toLocaleDateString("pt-BR")}
                        {auto && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link2 className="size-3.5 text-primary shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Gerado da venda{clienteNome ? ` de ${clienteNome}` : ""}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="p-2">{WEEKDAYS[dow]}</td>
                    <td className="p-2 text-right">{brl(r.loja)}</td>
                    <td className="p-2 text-right">{brl(r.custo)}</td>
                    <td className="p-2 text-right">{brl(r.juros_ml)}</td>
                    <td className="p-2 text-right">{brl(r.frete_empresa)}</td>
                    <td className="p-2 text-right">{brl(r.frete_cliente)}</td>
                    <td className="p-2 text-right">{brl(r.receber)}</td>
                    <td className={cn("p-2 text-right", r.lucro < 0 && "text-destructive")}>{brl(r.lucro)}</td>
                    <td className={cn(
                      "p-2 text-right font-medium",
                      r.saldo_acumulado < 0 && "text-destructive",
                      r.saldo_acumulado === 0 && "text-muted-foreground",
                      r.saldo_acumulado > 0 && "text-emerald-600",
                    )}>{brl(r.saldo_acumulado)}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {r.sale_id && (
                          <Button size="icon" variant="ghost" onClick={() => setAuditoriaId(r.sale_id!)} title="Auditoria do Lucro">
                            <ScanSearch className="size-4 text-primary" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => onEdit(r)} title={auto ? "Editar venda original" : "Editar"}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(r)}><Trash2 className="size-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-muted/50">
                <td className="p-2" colSpan={2}>TOTAL</td>
                <td className="p-2 text-right">{brl(totals.loja)}</td>
                <td className="p-2 text-right">{brl(totals.custo)}</td>
                <td className="p-2 text-right">{brl(totals.juros_ml)}</td>
                <td className="p-2 text-right">{brl(totals.frete_empresa)}</td>
                <td className="p-2 text-right">{brl(totals.frete_cliente)}</td>
                <td className="p-2 text-right">{brl(totals.receber)}</td>
                <td className={cn("p-2 text-right", totals.lucro < 0 && "text-destructive")}>{brl(totals.lucro)}</td>
                <td className={cn(
                  "p-2 text-right",
                  summary.saldoAtual < 0 && "text-destructive",
                  summary.saldoAtual > 0 && "text-emerald-600",
                )}>{brl(summary.saldoAtual)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Vendas do dia por cliente */}
      <VendasClienteCard
        mes={mes}
        vendas={vendasMes}
        search={vendaSearch}
        setSearch={setVendaSearch}
        canal={vendaCanal}
        setCanal={setVendaCanal}
        status={vendaStatus}
        setStatus={setVendaStatus}
        onVerDetalhe={(id) => setVendaDetalheId(id)}
      />

      <VendaDetalheDialog
        venda={vendasMes.find((v) => v.id === vendaDetalheId) ?? null}
        onClose={() => setVendaDetalheId(null)}
        onAuditar={(id) => { setVendaDetalheId(null); setAuditoriaId(id); }}
      />

      <AuditoriaLucroDialog saleId={auditoriaId} onClose={() => setAuditoriaId(null)} />
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  orcamento: "bg-muted text-muted-foreground",
  confirmado: "bg-blue-100 text-blue-800",
  separacao: "bg-amber-100 text-amber-800",
  enviado: "bg-indigo-100 text-indigo-800",
  entregue: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  confirmado: "Confirmado",
  separacao: "Separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const PAGTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  pix_prazo: "PIX a prazo",
  debito: "Débito",
  cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito",
  cartao: "Cartão",
  mercado_livre: "Mercado Livre",
  boleto: "Boleto",
  crediario: "Crediário",
  prazo: "A prazo",
  deposito: "Depósito",
  transferencia: "Transferência",
};

function VendasClienteCard({
  mes, vendas, search, setSearch, canal, setCanal, status, setStatus, onVerDetalhe,
}: {
  mes: number;
  vendas: any[];
  search: string; setSearch: (s: string) => void;
  canal: string; setCanal: (s: string) => void;
  status: string; setStatus: (s: string) => void;
  onVerDetalhe: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendas.filter((v) => {
      if (canal !== "todos" && v.channel !== canal) return false;
      if (status !== "todos" && v.status !== status) return false;
      if (term) {
        const nome = (v.customers?.name ?? v.customer_name ?? "").toLowerCase();
        if (!nome.includes(term)) return false;
      }
      return true;
    });
  }, [vendas, search, canal, status]);

  const totalValor = filtered.reduce((a, v) => a + Number(v.total ?? 0), 0);
  const ticketMedio = filtered.length > 0 ? totalValor / filtered.length : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg">Vendas do dia por cliente</h3>
            <p className="text-xs text-muted-foreground">Pedidos registrados em {MONTHS[mes - 1]}/{YEAR}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="pl-7 w-[200px]"
              />
            </div>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos canais</SelectItem>
                <SelectItem value="atacado">Atacado</SelectItem>
                <SelectItem value="varejo">Varejo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Data</th>
                <th className="p-2">Cliente</th>
                <th className="p-2">Canal</th>
                <th className="p-2">Pagto</th>
                <th className="p-2">Produtos</th>
                <th className="p-2 text-right">Qtd</th>
                <th className="p-2 text-right">Valor</th>
                <th className="p-2">Conta destino</th>
                <th className="p-2">Status</th>
                <th className="p-2 w-16">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhuma venda neste mês.</td></tr>
              )}
              {filtered.map((v) => {
                const d = new Date(v.sold_at);
                const items = v.sale_items ?? [];
                const qtd = items.reduce((a: number, it: any) => a + Number(it.quantity ?? 0), 0);
                const produtos = items.map((it: any) => it.products?.name).filter(Boolean);
                const produtosLabel = produtos.length === 0
                  ? "—"
                  : produtos.length <= 2
                    ? produtos.join(", ")
                    : `${produtos.slice(0, 2).join(", ")} +${produtos.length - 2}`;
                const cliente = v.customers?.name ?? v.customer_name ?? "Balcão";
                const conta = v.bank_accounts?.name ?? "—";
                return (
                  <tr key={v.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap">{d.toLocaleDateString("pt-BR")}</td>
                    <td className="p-2">{cliente}</td>
                    <td className="p-2 capitalize">{v.channel}</td>
                    <td className="p-2">{PAGTO_LABEL[v.payment_method] ?? v.payment_method}</td>
                    <td className="p-2 max-w-[260px] truncate" title={produtos.join(", ")}>{produtosLabel}</td>
                    <td className="p-2 text-right">{qtd}</td>
                    <td className="p-2 text-right font-medium">{brl(Number(v.total ?? 0))}</td>
                    <td className="p-2">{conta}</td>
                    <td className="p-2">
                      <Badge className={cn("font-normal", STATUS_TONE[v.status] ?? "bg-muted")} variant="secondary">
                        {STATUS_LABEL[v.status] ?? v.status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => onVerDetalhe(v.id)} title="Ver detalhes">
                        <Eye className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-muted/50">
                <td className="p-2" colSpan={6}>
                  TOTAL DO MÊS — {filtered.length} {filtered.length === 1 ? "venda" : "vendas"}
                </td>
                <td className="p-2 text-right">{brl(totalValor)}</td>
                <td className="p-2 text-muted-foreground" colSpan={3}>
                  Ticket médio: {brl(ticketMedio)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function VendaDetalheDialog({ venda, onClose, onAuditar }: { venda: any | null; onClose: () => void; onAuditar?: (id: string) => void }) {
  const open = !!venda;
  const items = venda?.sale_items ?? [];
  const subtotal = items.reduce((a: number, it: any) => a + Number(it.quantity ?? 0) * Number(it.unit_price ?? 0), 0);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Detalhes do pedido</span>
            {venda && onAuditar && (
              <Button size="sm" variant="outline" onClick={() => onAuditar(venda.id)}>
                <ScanSearch className="size-4 mr-1" /> Auditoria do Lucro
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {venda && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Info label="Data" value={new Date(venda.sold_at).toLocaleString("pt-BR")} />
              <Info label="Cliente" value={venda.customers?.name ?? venda.customer_name ?? "Balcão"} />
              <Info label="Canal" value={<span className="capitalize">{venda.channel}</span>} />
              <Info label="Pagamento" value={PAGTO_LABEL[venda.payment_method] ?? venda.payment_method} />
              <Info label="Status" value={STATUS_LABEL[venda.status] ?? venda.status} />
              <Info label="Conta destino" value={venda.bank_accounts?.name ?? "—"} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Itens</div>
              <table className="w-full text-sm border rounded">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">Produto</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-right">Unit.</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Sem itens</td></tr>
                  )}
                  {items.map((it: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2">{it.products?.name ?? "—"}</td>
                      <td className="p-2 text-right">{it.quantity}</td>
                      <td className="p-2 text-right">{brl(Number(it.unit_price ?? 0))}</td>
                      <td className="p-2 text-right">{brl(Number(it.quantity ?? 0) * Number(it.unit_price ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="text-muted-foreground">Subtotal: {brl(subtotal)}</div>
              {Number(venda.discount ?? 0) > 0 && (
                <div className="text-muted-foreground">Desconto: −{brl(Number(venda.discount))}</div>
              )}
              <div className="font-display text-lg">Total: {brl(Number(venda.total ?? 0))}</div>
            </div>
            {venda.notes && (
              <div className="rounded border bg-muted/30 px-3 py-2">
                <div className="text-xs text-muted-foreground mb-0.5">Observações</div>
                <div>{venda.notes}</div>
              </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" | "neutral" | "info" }) {
  return (
    <Card className="bg-primary/5">
      <CardContent className="pt-4 pb-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn(
          "font-display text-lg mt-1",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-destructive",
          tone === "info" && "text-blue-600",
        )}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PreviewBox({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return (
    <div className="rounded-lg border bg-primary/5 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn(
        "font-medium",
        tone === "positive" && "text-emerald-600",
        tone === "negative" && "text-destructive",
      )}>{value}</div>
    </div>
  );
}

function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Como funciona o Controle de Vendas</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section>
            <h3 className="font-semibold text-base mb-1 flex items-center gap-2">📌 Objetivo desta tela</h3>
            <p className="text-muted-foreground">
              O Controle de Vendas permite acompanhar diariamente o desempenho financeiro das suas vendas,
              calculando automaticamente o <b>Lucro Real</b> e a <b>Margem</b> de cada dia e do mês inteiro.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">📊 Painel de resumo (cards do topo)</h3>
            <p className="text-muted-foreground mb-2">Os cards mostram o consolidado do mês selecionado:</p>
            <ul className="space-y-2">
              <li><span className="text-emerald-600 font-medium">🟢 RECEBER</span> — Total das vendas do mês (soma da coluna Loja).</li>
              <li><span className="text-emerald-600 font-medium">🟢 LUCRO</span> — O que sobrou depois de todos os custos.
                <div className="mt-1 rounded-md bg-muted px-3 py-2 font-mono text-xs">Receber − Custo − Juros ML − Frete Empresa</div>
              </li>
              <li><span className="text-blue-600 font-medium">🔵 MARGEM %</span> — Percentual de lucro sobre o recebido.
                <div className="mt-1 rounded-md bg-muted px-3 py-2 font-mono text-xs">Lucro ÷ Receber × 100</div>
              </li>
              <li><span className="font-medium">⚪ CUSTO</span> — Soma do custo de todos os produtos vendidos no mês.</li>
              <li><span className="text-destructive font-medium">🔴 FORNECEDOR</span> — Total devido aos fornecedores no mês (valor negativo = dívida).</li>
              <li><span className="text-destructive font-medium">🔴 RATEIO</span> — Quanto ainda deve ao fornecedor após abater o custo.
                <div className="mt-1 rounded-md bg-muted px-3 py-2 font-mono text-xs">|Fornecedor| − Custo</div>
              </li>
              <li><span className="text-destructive font-medium">🔴 SALDO</span> — Mesmo valor do Rateio (saldo devedor com fornecedor).</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">➕ Como fazer um novo lançamento</h3>
            <ol className="list-decimal ml-5 space-y-2">
              <li>Selecione a <b>Data</b> (o dia da semana aparece automaticamente).</li>
              <li><b>Loja (R$)</b> — total das vendas do dia. Vendas do módulo "Vendas" com status <b>Entregue</b> aparecem aqui automaticamente.</li>
              <li><b>Custo (R$)</b> — calculado pelo custo real de cada produto vendido; ajustável manualmente.</li>
              <li><b>Juros ML (R$)</b> — taxa do Mercado Livre. Deixe zero se não usou ML.</li>
              <li><b>Frete Empresa (R$)</b> — valor pago aos Correios. Não entra no total da venda; apenas reduz o lucro.</li>
              <li><b>Frete Cliente (R$)</b> — valor cobrado do cliente pelo frete; é exibido para composição e auditoria, mas não é somado novamente ao lucro porque já está incorporado ao valor recebido da venda.</li>
              <li>Veja a <b>prévia</b> em tempo real: A receber, Lucro e Margem do dia antes de salvar.</li>
              <li>Clique em <b>Salvar</b>.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">🔒 Total devido a fornecedores</h3>
            <p className="text-muted-foreground">
              Representa o total que você deve pagar aos fornecedores no mês corrente.
            </p>
            <ul className="mt-2 space-y-1 list-disc ml-5">
              <li>Fica <b>bloqueado durante o mês</b> (só pode ser editado no 1º dia do mês seguinte).</li>
              <li>Clique em <b>Editar</b> para alterar em caso de renegociação (registra histórico).</li>
              <li>Este valor alimenta os cálculos de Fornecedor, Rateio e Saldo.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">📋 Tabela de lançamentos</h3>
            <ul className="space-y-1 list-disc ml-5">
              <li><b>Lançamentos automáticos (🔗)</b> — gerados por vendas com status "Entregue". Não editáveis aqui — edite na tela Vendas.</li>
              <li><b>Lançamentos manuais</b> — editáveis e excluíveis diretamente.</li>
              <li>A coluna <b>Saldo</b> mostra o saldo acumulado devedor com o fornecedor após cada lançamento do dia.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 flex items-center gap-2">📤 Exportações</h3>
            <ul className="space-y-1 list-disc ml-5">
              <li><b>Exportar Excel</b> — planilha do mês selecionado com todos os lançamentos e totais.</li>
              <li><b>Exportar PDF Anual</b> — relatório com todos os meses do ano, linha por linha, com totais anuais.</li>
            </ul>
          </section>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>Entendi ✓</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
