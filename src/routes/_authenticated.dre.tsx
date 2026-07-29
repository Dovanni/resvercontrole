import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

import { getDreReport } from "@/lib/dre/dre.functions";
import { exportDrePdf, exportDreXlsx } from "@/lib/dre/export";
import {
  PERIOD_PRESET_LABEL,
  SIMPLIFIED_LINE_KEYS,
  type ComparisonMode,
  type DreLine,
  type PeriodPreset,
} from "@/lib/dre/types";
import { resolvePreset, todayInTz, formatCivil } from "@/lib/dre/periods";

export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({
    meta: [
      { title: "DRE Tradicional — Vejamais" },
      {
        name: "description",
        content:
          "Demonstração do Resultado do Exercício por regime de competência, com comparativos, margens e exportação em PDF e Excel.",
      },
      { property: "og:title", content: "DRE Tradicional — Vejamais" },
      {
        property: "og:description",
        content:
          "DRE gerencial por competência com receita bruta, deduções, CMV, despesas operacionais, EBITDA e resultado líquido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DrePage,
});

const brlCents = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PRESETS: PeriodPreset[] = [
  "mes_atual",
  "mes_anterior",
  "trimestre_atual",
  "trimestre_anterior",
  "semestre_atual",
  "semestre_anterior",
  "ano_atual",
  "ano_anterior",
  "acumulado_ano",
  "ultimos_12_meses",
  "personalizado",
];

function DrePage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<PeriodPreset>("mes_atual");
  const [custom, setCustom] = useState(() => {
    const p = resolvePreset("mes_atual");
    return { from: p.from, to: todayInTz() };
  });
  const [comparison, setComparison] = useState<ComparisonMode>("none");
  const [view, setView] = useState<"consolidado" | "simplificado" | "mensal">("consolidado");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showHelp, setShowHelp] = useState(false);

  const fetchDre = useServerFn(getDreReport);

  const { data: company } = useQuery({
    queryKey: ["dre-company", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("company_name, cnpj")
        .maybeSingle();
      return data;
    },
  });

  const { data, isFetching, error } = useQuery({
    queryKey: ["dre", preset, custom.from, custom.to, comparison],
    queryFn: () =>
      fetchDre({
        data: {
          preset,
          from: custom.from,
          to: custom.to,
          comparison,
        },
      }),
  });

  const meta = useMemo(
    () => ({
      empresa: company?.company_name || "Vejamais — Gestão Comercial e Financeira",
      documento: company?.cnpj ? `CNPJ ${company.cnpj}` : null,
      emitidoEm: formatCivil(todayInTz()),
      regime: "Competência (accrual) — princípio da entidade",
    }),
    [company],
  );

  const visibleLines = useMemo(() => {
    if (!data) return [];
    const lines = data.current.lines.filter((l) => l.kind !== "item" || l.amountCents !== 0);
    if (view === "simplificado") {
      // Mesmo motor, mesmas linhas: apenas o recorte estruturante.
      return lines.filter((l) => SIMPLIFIED_LINE_KEYS.includes(l.key));
    }
    return lines;
  }, [data, view]);

  const toggle = (key: string) =>
    setExpanded((e) => ({ ...e, [key]: !e[key] }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="DRE Tradicional"
        subtitle="Demonstração do Resultado do Exercício — regime de competência"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHelp(true)}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Como é calculado
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data}
              onClick={() => data && exportDrePdf(data, meta)}
            >
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data}
              onClick={() => data && exportDreXlsx(data, meta)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Período</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIOD_PRESET_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>De</Label>
            <Input
              type="date"
              value={custom.from}
              disabled={preset !== "personalizado"}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input
              type="date"
              value={custom.to}
              disabled={preset !== "personalizado"}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Comparativo</Label>
            <Select value={comparison} onValueChange={(v) => setComparison(v as ComparisonMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem comparativo</SelectItem>
                <SelectItem value="previous">Período anterior</SelectItem>
                <SelectItem value="last_year">Mesmo período do ano anterior</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MarginCard label="Margem bruta" value={data.current.margins.brutaPct} />
            <MarginCard label="Margem EBITDA" value={data.current.margins.ebitdaPct} />
            <MarginCard label="Margem operacional" value={data.current.margins.operacionalPct} />
            <MarginCard label="Margem líquida" value={data.current.margins.liquidaPct} />
          </div>

          {data.current.unclassifiedCents > 0 && (
            <Card className="border-amber-500/60 bg-amber-500/5">
              <CardContent className="flex items-start gap-2 p-4 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Existem <strong>{brlCents(data.current.unclassifiedCents)}</strong> em lançamentos
                  ainda não classificados no plano de contas do DRE. Eles ficam fora do resultado e
                  aparecem nas notas gerenciais até serem classificados.
                </span>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div>
                  <p className="font-semibold">{meta.empresa}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.current.period.label} · Regime de competência ·{" "}
                    {data.current.timezone}
                  </p>
                </div>
                <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
                  <TabsList>
                    <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
                    <TabsTrigger
                      value="mensal"
                      disabled={data.current.monthly.length < 2}
                    >
                      Mensal
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {isFetching && (
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Atualizando…
                </div>
              )}

              <div className="overflow-x-auto">
                {view === "consolidado" ? (
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Conta</th>
                        <th className="px-4 py-2 text-right font-medium">Valor</th>
                        <th className="px-4 py-2 text-right font-medium">% RL</th>
                        {data.comparison && (
                          <>
                            <th className="px-4 py-2 text-right font-medium">
                              {data.comparison.period.label}
                            </th>
                            <th className="px-4 py-2 text-right font-medium">Variação</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines.map((l) => (
                        <LineRow
                          key={l.key}
                          line={l}
                          comparison={data.comparison?.amountByLineKey[l.key]}
                          expanded={!!expanded[l.key]}
                          onToggle={() => toggle(l.key)}
                        />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="sticky left-0 z-10 bg-muted/50 px-4 py-2 text-left font-medium">
                          Conta
                        </th>
                        {data.current.monthly.map((m) => (
                          <th key={m.key} className="px-4 py-2 text-right font-medium">
                            {m.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines
                        .filter((l) => l.kind !== "header")
                        .map((l) => (
                          <tr
                            key={l.key}
                            className={
                              l.kind === "total"
                                ? "border-t bg-muted/40 font-semibold"
                                : "border-t"
                            }
                          >
                            <td className="sticky left-0 z-10 bg-background px-4 py-2">
                              {l.level > 0 && <span className="pl-4" />}
                              {l.label}
                            </td>
                            {data.current.monthly.map((m) => (
                              <td key={m.key} className="px-4 py-2 text-right tabular-nums">
                                {brlCents(m.amountByLineKey[l.key] ?? 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4">
                <p className="font-semibold">Notas gerenciais</p>
                <p className="text-sm text-muted-foreground">
                  Movimentos legítimos do negócio que, pelo princípio da entidade e pelo regime de
                  competência, <strong>não compõem o resultado empresarial</strong>.
                </p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.current.notes.map((n) => (
                    <tr key={n.key} className="border-b last:border-0">
                      <td className="px-4 py-2">{n.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {brlCents(n.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como o DRE é calculado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Regime de competência.</strong> Cada valor é
              reconhecido na data do fato gerador — a venda entra pela data da venda e a obrigação
              pela data de vencimento —, independentemente de quando o dinheiro entra ou sai. O
              Fluxo de Caixa continua responsável pelo regime de caixa.
            </p>
            <p>
              <strong className="text-foreground">Princípio da entidade.</strong> Retiradas e
              gastos pessoais dos sócios, compras de estoque (que viram ativo, não despesa),
              pagamentos de faturas e aportes não afetam o resultado. Eles aparecem nas notas
              gerenciais.
            </p>
            <p>
              <strong className="text-foreground">Fontes autoritativas.</strong> Receita, descontos,
              frete e CMV vêm de vendas e itens de venda. Despesas vêm das contas a pagar,
              classificadas pelo plano de contas do DRE. Recebimentos ligados a vendas são
              liquidação — nunca receita nova.
            </p>
            <p>
              <strong className="text-foreground">Datas.</strong> Todo o recorte usa datas civis no
              fuso da empresa ({data?.current.timezone ?? "America/Sao_Paulo"}), o que impede que um
              lançamento do dia 1º apareça no mês anterior.
            </p>
            <p>
              <strong className="text-foreground">Linhas sem fonte.</strong> Depreciação, IRPJ e
              CSLL aparecem zeradas e sinalizadas enquanto não houver origem de dados configurada —
              nunca são estimadas.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarginCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${
            value === null ? "" : value < 0 ? "text-destructive" : "text-emerald-600"
          }`}
        >
          {value === null ? "—" : `${value.toFixed(1)}%`}
        </p>
      </CardContent>
    </Card>
  );
}

function LineRow({
  line,
  comparison,
  expanded,
  onToggle,
}: {
  line: DreLine;
  comparison?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetail = !!line.detail?.length;
  const diff = comparison === undefined ? null : line.amountCents - comparison;
  const favorable =
    diff === null
      ? null
      : line.nature === "despesa"
        ? diff < 0
        : diff > 0;

  const rowClass =
    line.kind === "total"
      ? "border-t-2 bg-muted/50 font-semibold"
      : line.kind === "subtotal"
        ? "border-t bg-muted/25 font-medium"
        : line.kind === "header"
          ? "border-t bg-background text-xs uppercase tracking-wide text-muted-foreground"
          : "border-t";

  return (
    <>
      <tr className={rowClass}>
        <td className="px-4 py-2">
          <div className={`flex items-center gap-1.5 ${line.level > 0 ? "pl-5" : ""}`}>
            {hasDetail ? (
              <button
                type="button"
                onClick={onToggle}
                className="rounded p-0.5 hover:bg-muted"
                aria-label={expanded ? "Recolher detalhamento" : "Expandir detalhamento"}
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-[18px]" />
            )}
            <span>{line.label}</span>
            {line.notConfigured && (
              <span className="ml-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase text-muted-foreground">
                <Info className="h-3 w-3" />
                sem fonte configurada
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-right tabular-nums">{brlCents(line.amountCents)}</td>
        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
          {line.percentOfNetRevenue === null ? "—" : `${line.percentOfNetRevenue.toFixed(1)}%`}
        </td>
        {comparison !== undefined && (
          <>
            <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
              {brlCents(comparison)}
            </td>
            <td
              className={`px-4 py-2 text-right tabular-nums ${
                favorable === null ? "" : favorable ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {diff === null ? "—" : brlCents(diff)}
            </td>
          </>
        )}
      </tr>
      {expanded &&
        line.detail?.map((d) => (
          <tr key={`${line.key}-${d.source}-${d.id}`} className="bg-muted/10 text-xs">
            <td className="px-4 py-1.5 pl-14 text-muted-foreground">{d.label}</td>
            <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">
              {brlCents(d.amountCents)}
            </td>
            <td className="px-4 py-1.5 text-right text-muted-foreground">{d.source}</td>
            {comparison !== undefined && (
              <>
                <td />
                <td />
              </>
            )}
          </tr>
        ))}
    </>
  );
}
