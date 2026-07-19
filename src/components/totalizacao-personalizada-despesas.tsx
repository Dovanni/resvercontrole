import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { brl } from "@/lib/format";
import {
  DespesaPayable,
  getAnnualExpenseMonthIndex,
  getAnnualExpenseValue,
  isAnnualExpenseIncluded,
} from "@/lib/despesas-anuais";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Mode = "fornecedores" | "categorias";

type Option = {
  key: string;
  label: string;
  count: number;
  totalPeriodo: number;
};

type Aggregation = {
  months: number[]; // 13
  totalAno: number; // meses 0..11
  janSeguinte: number; // mês 12
  totalPeriodo: number;
  count: number; // payables únicos
};

const SEM_FORNECEDOR = "__sem_fornecedor__";
const SEM_CATEGORIA = "__sem_categoria__";

function emptyAgg(): Aggregation {
  return { months: Array(13).fill(0), totalAno: 0, janSeguinte: 0, totalPeriodo: 0, count: 0 };
}

function keyOf(p: DespesaPayable, mode: Mode): string {
  if (mode === "fornecedores") return p.supplier_id ?? SEM_FORNECEDOR;
  const c = p.category ?? "";
  return c === "" ? SEM_CATEGORIA : c;
}

function labelOf(p: DespesaPayable, mode: Mode): string {
  if (mode === "fornecedores") return p.suppliers?.name ?? "Sem fornecedor";
  return p.category?.trim() ? p.category : "Sem categoria";
}

function aggregate(payables: DespesaPayable[], year: number): Aggregation {
  const agg = emptyAgg();
  const seen = new Set<string>();
  for (const p of payables) {
    if (!isAnnualExpenseIncluded(p)) continue;
    const idx = getAnnualExpenseMonthIndex(p, year);
    if (idx < 0) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const v = getAnnualExpenseValue(p);
    agg.months[idx] += v;
    agg.count++;
  }
  for (let i = 0; i < 12; i++) agg.totalAno += agg.months[i];
  agg.janSeguinte = agg.months[12];
  agg.totalPeriodo = agg.totalAno + agg.janSeguinte;
  return agg;
}

export function TotalizacaoPersonalizadaDespesas({
  payables,
  year,
}: {
  payables: DespesaPayable[];
  year: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [mode, setMode] = useState<Mode>("fornecedores");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showIndividual, setShowIndividual] = useState(true);
  const [showAgrupado, setShowAgrupado] = useState(true);

  // Ao trocar o modo, limpa seleção e busca (não mistura chaves).
  useEffect(() => {
    setSelected(new Set());
    setSearch("");
  }, [mode]);

  // Escopo dos payables aplicáveis ao período/regra.
  const inScope = useMemo(
    () =>
      (payables ?? []).filter(
        (p) => isAnnualExpenseIncluded(p) && getAnnualExpenseMonthIndex(p, year) >= 0,
      ),
    [payables, year],
  );

  // Opções agrupadas por chave estável do modo atual.
  const options = useMemo<Option[]>(() => {
    const map = new Map<string, { label: string; count: number; total: number }>();
    for (const p of inScope) {
      const k = keyOf(p, mode);
      const l = labelOf(p, mode);
      const entry = map.get(k) ?? { label: l, count: 0, total: 0 };
      entry.count++;
      entry.total += getAnnualExpenseValue(p);
      map.set(k, entry);
    }
    const arr: Option[] = Array.from(map.entries()).map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      totalPeriodo: v.total,
    }));
    arr.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return arr;
  }, [inScope, mode]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // Cálculos individuais por chave selecionada.
  const individuais = useMemo(() => {
    if (selected.size === 0) return [] as { key: string; label: string; agg: Aggregation }[];
    const grouped = new Map<string, DespesaPayable[]>();
    for (const p of inScope) {
      const k = keyOf(p, mode);
      if (!selected.has(k)) continue;
      const arr = grouped.get(k) ?? [];
      arr.push(p);
      grouped.set(k, arr);
    }
    const list = Array.from(grouped.entries()).map(([key, ps]) => ({
      key,
      label: labelOf(ps[0], mode),
      agg: aggregate(ps, year),
    }));
    list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return list;
  }, [inScope, mode, selected, year]);

  // Cálculo agrupado — a partir dos payables filtrados (SSoT única, sem soma de sub-estruturas).
  const agrupado = useMemo(() => {
    if (selected.size === 0) return emptyAgg();
    const filtered = inScope.filter((p) => selected.has(keyOf(p, mode)));
    return aggregate(filtered, year);
  }, [inScope, mode, selected, year]);

  // Validação DEV: soma individuais == agrupado (tolerância R$ 0,01).
  if (import.meta.env.DEV && individuais.length > 0) {
    const soma = individuais.reduce((s, i) => s + i.agg.totalPeriodo, 0);
    if (Math.abs(soma - agrupado.totalPeriodo) > 0.01) {
      // eslint-disable-next-line no-console
      console.warn("[TotalizacaoPersonalizada] divergência individuais vs agrupado", {
        soma, agrupado: agrupado.totalPeriodo,
      });
    }
  }

  const monthHeader = (i: number) => (i === 12 ? `Jan/${year + 1}` : `${MONTHS[i]}/${String(year).slice(2)}`);

  const toggleKey = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    for (const o of filteredOptions) next.add(o.key);
    setSelected(next);
  };

  const clearAll = () => setSelected(new Set());

  // Maior/menor mês do ano-base (0..11) com valor > 0.
  const maiorMenor = useMemo(() => {
    if (agrupado.count === 0) return { maior: null, menor: null } as {
      maior: { i: number; v: number } | null;
      menor: { i: number; v: number } | null;
    };
    let maior: { i: number; v: number } | null = null;
    let menor: { i: number; v: number } | null = null;
    for (let i = 0; i < 12; i++) {
      const v = agrupado.months[i];
      if (v > 0) {
        if (!maior || v > maior.v) maior = { i, v };
        if (!menor || v < menor.v) menor = { i, v };
      }
    }
    return { maior, menor };
  }, [agrupado]);

  const mediaMensal = agrupado.totalAno / 12;

  const bothOff = !showIndividual && !showAgrupado;

  return (
    <Card className="shadow-soft mt-4">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-display">📊 Totalização Personalizada de Despesas</h2>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>

        {expanded && (
          <>
            {/* Seleção de modo */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modo-totalizacao"
                  checked={mode === "fornecedores"}
                  onChange={() => setMode("fornecedores")}
                />
                Fornecedores
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modo-totalizacao"
                  checked={mode === "categorias"}
                  onChange={() => setMode("categorias")}
                />
                Categorias
              </label>
              <div className="flex-1" />
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={showIndividual}
                    onCheckedChange={(v) => setShowIndividual(Boolean(v))}
                  />
                  Exibir totais individuais
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={showAgrupado}
                    onCheckedChange={(v) => setShowAgrupado(Boolean(v))}
                  />
                  Exibir total agrupado
                </label>
              </div>
            </div>

            {/* Busca + ações */}
            <div className="grid md:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <div className="relative">
                <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={mode === "fornecedores" ? "Buscar fornecedor..." : "Buscar categoria..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {selected.size} selecionado{selected.size === 1 ? "" : "s"}
              </div>
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                Selecionar todos
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Limpar seleção
              </Button>
            </div>

            {/* Lista de opções */}
            <div className="border rounded-lg max-h-56 overflow-y-auto divide-y">
              {filteredOptions.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma opção encontrada.
                </div>
              )}
              {filteredOptions.map((o) => (
                <label
                  key={o.key}
                  className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-primary/5"
                >
                  <Checkbox
                    checked={selected.has(o.key)}
                    onCheckedChange={() => toggleKey(o.key)}
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {o.count} lçto{o.count === 1 ? "" : "s"} · {brl(o.totalPeriodo)}
                  </span>
                </label>
              ))}
            </div>

            {bothOff && (
              <div className="text-sm text-amber-600">
                Ative ao menos "Exibir totais individuais" ou "Exibir total agrupado".
              </div>
            )}

            {selected.size === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center border rounded-lg">
                Selecione ao menos um {mode === "fornecedores" ? "fornecedor" : "categoria"} para
                visualizar a totalização.
              </div>
            ) : agrupado.count === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center border rounded-lg">
                Nenhuma despesa encontrada para as opções selecionadas neste período.
              </div>
            ) : (
              <>
                {/* Individuais */}
                {showIndividual && (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-primary/10">
                        <tr>
                          <th className="text-left px-2 py-2 sticky left-0 bg-primary/10 min-w-40">
                            {mode === "fornecedores" ? "Fornecedor" : "Categoria"}
                          </th>
                          {Array.from({ length: 13 }, (_, i) => (
                            <th key={i} className="text-right px-2 py-2 whitespace-nowrap">
                              {monthHeader(i)}
                            </th>
                          ))}
                          <th className="text-right px-2 py-2 whitespace-nowrap">Total ano</th>
                          <th className="text-right px-2 py-2 whitespace-nowrap">Jan seguinte</th>
                          <th className="text-right px-2 py-2 whitespace-nowrap">Total período</th>
                          <th className="text-right px-2 py-2 whitespace-nowrap">Lçtos</th>
                          <th className="text-right px-2 py-2 whitespace-nowrap">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {individuais.map((row, ri) => {
                          const pct =
                            agrupado.totalPeriodo > 0
                              ? (row.agg.totalPeriodo / agrupado.totalPeriodo) * 100
                              : 0;
                          return (
                            <tr key={row.key} className={ri % 2 === 0 ? "bg-primary/5" : ""}>
                              <td className="px-2 py-1.5 sticky left-0 bg-inherit font-medium truncate max-w-56">
                                {row.label}
                              </td>
                              {row.agg.months.map((v, i) => (
                                <td key={i} className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                  {v > 0 ? brl(v) : ""}
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">
                                {brl(row.agg.totalAno)}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {row.agg.janSeguinte > 0 ? brl(row.agg.janSeguinte) : ""}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">
                                {brl(row.agg.totalPeriodo)}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{row.agg.count}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{pct.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Agrupado */}
                {showAgrupado && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-semibold">
                          Total agrupado — {selected.size} {mode === "fornecedores" ? "fornecedor" : "categoria"}
                          {selected.size === 1 ? "" : mode === "fornecedores" ? "es" : "s"} selecionado
                          {selected.size === 1 ? "" : "s"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {agrupado.count} lançamento{agrupado.count === 1 ? "" : "s"}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-primary/10">
                              {Array.from({ length: 13 }, (_, i) => (
                                <th key={i} className="text-right px-2 py-2 whitespace-nowrap">
                                  {monthHeader(i)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {agrupado.months.map((v, i) => (
                                <td key={i} className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                  {v > 0 ? brl(v) : ""}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Total anual</div>
                          <div className="font-display text-lg tabular-nums">{brl(agrupado.totalAno)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Jan/{year + 1}</div>
                          <div className="font-display text-lg tabular-nums">{brl(agrupado.janSeguinte)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Total do período</div>
                          <div className="font-display text-lg tabular-nums text-primary">
                            {brl(agrupado.totalPeriodo)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Média mensal (ano-base)</div>
                          <div className="font-display text-lg tabular-nums">{brl(mediaMensal)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Maior / Menor mês</div>
                          <div className="text-sm">
                            {maiorMenor.maior
                              ? `${MONTHS[maiorMenor.maior.i]} ${brl(maiorMenor.maior.v)}`
                              : "Sem movimentação"}
                            <span className="text-muted-foreground"> · </span>
                            {maiorMenor.menor
                              ? `${MONTHS[maiorMenor.menor.i]} ${brl(maiorMenor.menor.v)}`
                              : "Sem movimentação"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
