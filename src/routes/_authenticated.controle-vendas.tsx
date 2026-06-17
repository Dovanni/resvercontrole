import { createFileRoute } from "@tanstack/react-router";
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
import { FileSpreadsheet, Pencil, Trash2, Save, Eraser } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/controle-vendas")({
  head: () => ({ meta: [{ title: "Controle de Vendas — Rosé" }] }),
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

// Fórmulas oficiais:
// RECEBER = LOJA - JUROS_ML - FRETE_CLIENTE
// LUCRO   = LOJA - CUSTO - FRETE_EMPRESA - JUROS_ML
// MARGEM  = RECEBER * 100 / LOJA
// RATEIO (mensal) = TOTAL_FORNECEDOR - SUM(CUSTO)
const calcReceber = (loja: number, juros: number, freteCli: number) => loja - juros - freteCli;
const calcLucro = (loja: number, custo: number, freteEmp: number, juros: number) =>
  loja - custo - freteEmp - juros;
const calcMargem = (receber: number, loja: number) => (loja > 0 ? (receber * 100) / loja : 0);

function ControleVendasPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [form, setForm] = useState(emptyForm());
  const [fornecedorInput, setFornecedorInput] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["controle-vendas", YEAR, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_vendas_diario")
        .select("*")
        .eq("ano", YEAR)
        .eq("mes", mes)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: fornecedorRow } = useQuery({
    queryKey: ["controle-vendas-fornecedor", YEAR, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_vendas_fornecedor")
        .select("*")
        .eq("ano", YEAR)
        .eq("mes", mes)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; valor_fornecedor: number } | null;
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
    const receber = calcReceber(loja, juros, frete_cli);
    const lucro = calcLucro(loja, custo, frete_emp, juros);
    const margem = calcMargem(receber, loja);
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

  const summary = useMemo(() => {
    const fornecedor = num(fornecedorInput);
    const investimento = totals.custo + totals.juros_ml + totals.frete_empresa;
    const saldo = fornecedor - investimento;
    const rateio = fornecedor - totals.custo;
    const margem = calcMargem(totals.receber, totals.loja);
    return { receber: totals.receber, lucro: totals.lucro, margem, rateio, fornecedor, investimento, saldo };
  }, [totals, fornecedorInput]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("Sem usuário");
      const d = new Date(form.data + "T00:00:00");
      const payload = {
        user_id,
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

  const saveFornecedor = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user_id = userRes.user?.id;
      if (!user_id) throw new Error("Sem usuário");
      const payload = { user_id, mes, ano: YEAR, valor_fornecedor: num(fornecedorInput) };
      const { error } = await supabase
        .from("controle_vendas_fornecedor")
        .upsert(payload, { onConflict: "user_id,mes,ano" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor do mês salvo");
      qc.invalidateQueries({ queryKey: ["controle-vendas-fornecedor"] });
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
    const ok = await confirm({
      title: "Excluir lançamento?",
      description: `Lançamento de ${new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")} será removido.`,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Vendas"
        subtitle="Lançamento diário e resumo mensal"
        action={
          <div className="flex items-center gap-2">
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
          </div>
        }
      />

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <SummaryCard label="Receber" value={brl(summary.receber)} tone="positive" />
        <SummaryCard label="Lucro" value={brl(summary.lucro)} tone={summary.lucro >= 0 ? "positive" : "negative"} />
        <SummaryCard label="Margem" value={`${summary.margem.toFixed(1)}%`} tone={summary.lucro >= 0 ? "positive" : "negative"} />
        <SummaryCard label="Rateio" value={brl(summary.rateio)} tone={summary.rateio >= 0 ? "neutral" : "negative"} />
        <SummaryCard label="Fornecedor" value={brl(summary.fornecedor)} tone="neutral" />
        <SummaryCard label="Investimento" value={brl(summary.investimento)} tone="neutral" />
        <SummaryCard label="Saldo" value={brl(summary.saldo)} tone={summary.saldo >= 0 ? "positive" : "negative"} />
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <Label>Total devido a fornecedores em {MONTHS[mes - 1]}/{YEAR}</Label>
              <Input
                inputMode="decimal"
                value={fornecedorInput}
                onChange={(e) => setFornecedorInput(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <Button onClick={() => saveFornecedor.mutate()} disabled={saveFornecedor.isPending}>
              <Save className="size-4 mr-2" /> Salvar fornecedor
            </Button>
          </div>
        </CardContent>
      </Card>

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
                <th className="p-2 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhum lançamento neste mês.</td></tr>
              )}
              {rows.map((r) => {
                const d = new Date(r.data + "T00:00:00");
                const dow = d.getDay();
                const weekend = dow === 0 || dow === 6;
                return (
                  <tr key={r.id} className={cn("border-b", weekend && "bg-primary/10")}>
                    <td className="p-2">{d.toLocaleDateString("pt-BR")}</td>
                    <td className="p-2">{WEEKDAYS[dow]}</td>
                    <td className="p-2 text-right">{brl(r.loja)}</td>
                    <td className="p-2 text-right">{brl(r.custo)}</td>
                    <td className="p-2 text-right">{brl(r.juros_ml)}</td>
                    <td className="p-2 text-right">{brl(r.frete_empresa)}</td>
                    <td className="p-2 text-right">{brl(r.frete_cliente)}</td>
                    <td className="p-2 text-right">{brl(r.receber)}</td>
                    <td className={cn("p-2 text-right", r.rateio < 0 && "text-destructive")}>{brl(r.rateio)}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => onEdit(r)}><Pencil className="size-4" /></Button>
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
                <td className={cn("p-2 text-right", totals.rateio < 0 && "text-destructive")}>{brl(totals.rateio)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
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

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" | "neutral" }) {
  return (
    <Card className="bg-primary/5">
      <CardContent className="pt-4 pb-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn(
          "font-display text-lg mt-1",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-destructive",
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
