import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, CheckCircle2, AlertCircle, Pencil, ArrowUpDown, Download, ChevronDown, ChevronRight, Settings, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { useConfirm } from "@/components/confirm-dialog";
import { DataPagination, usePagination } from "@/components/data-pagination";
import { useCategoriasContasPagar } from "@/components/categorias-contas-pagar-manager";
import * as XLSX from "xlsx";

type PeriodPreset = "all" | "today" | "week" | "month" | "next30" | "next90" | "custom";
type GroupBy = "none" | "month" | "supplier" | "category";

function computePresetRange(preset: PeriodPreset): { from: string; to: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "today") return { from: iso(today), to: iso(today) };
  if (preset === "week") {
    const day = today.getDay(); const start = new Date(today); start.setDate(today.getDate() - day);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: iso(start), to: iso(end) };
  }
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: iso(start), to: iso(end) };
  }
  if (preset === "next30") {
    const end = new Date(today); end.setDate(today.getDate() + 30);
    return { from: iso(today), to: iso(end) };
  }
  if (preset === "next90") {
    const end = new Date(today); end.setDate(today.getDate() + 90);
    return { from: iso(today), to: iso(end) };
  }
  return { from: "", to: "" };
}

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export const Route = createFileRoute("/_authenticated/contas-pagar")({
  head: () => ({ meta: [{ title: "Contas a pagar — Rosé" }] }),
  component: PayablesPage,
});

const FALLBACK_CATEGORIES = ["fornecedor", "logistica", "marketing", "aluguel", "impostos", "outros"];
const PAYMENT_METHODS = ["pix", "boleto", "transferência", "dinheiro", "cartão"];

type Payable = {
  id: string; supplier_id: string | null; description: string; category: string;
  amount: number; due_date: string; payment_method: string | null;
  bank_account_id: string | null;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  paid_amount: number; paid_at: string | null;
  recurrence: "nenhuma" | "semanal" | "mensal";
  suppliers?: { name: string } | null;
};

// Series detection: descriptions like "DAS MEI (3/7)"
const SERIES_RE = /^(.*?)\s*\((\d+)\/(\d+)\)\s*$/;
function parseSeries(desc: string) {
  const m = desc.match(SERIES_RE);
  if (!m) return null;
  return { base: m[1].trim(), index: Number(m[2]), total: Number(m[3]) };
}
function findSeriesItems(all: Payable[], target: Payable) {
  const s = parseSeries(target.description);
  if (!s) return null;
  const items = all
    .map((p) => ({ p, s: parseSeries(p.description) }))
    .filter((x) => x.s && x.s.base === s.base && x.s.total === s.total)
    .map((x) => ({ ...x.p, _idx: x.s!.index }))
    .sort((a, b) => a._idx - b._idx);
  return items.length > 1 ? { base: s.base, total: s.total, current: s.index, items } : null;
}

type SortKey = "due_date" | "description" | "supplier" | "category" | "status" | "amount";

function PayablesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [payTarget, setPayTarget] = useState<Payable | null>(null);
  const [editTarget, setEditTarget] = useState<Payable | null>(null);

  // filters
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [fSupplier, setFSupplier] = useState("__all__");
  const [fCategory, setFCategory] = useState("__all__");
  const [fStatus, setFStatus] = useState("__all__");
  const [fSearch, setFSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "due_date", dir: "asc" });

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    if (p === "all") { setFDateFrom(""); setFDateTo(""); return; }
    if (p === "custom") return;
    const r = computePresetRange(p);
    setFDateFrom(r.from); setFDateTo(r.to);
  };
  const clearFilters = () => {
    setPreset("all"); setFDateFrom(""); setFDateTo("");
    setFSupplier("__all__"); setFCategory("__all__"); setFStatus("__all__"); setFSearch("");
  };

  const { data } = useQuery({
    queryKey: ["payables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables")
        .select("*, suppliers(name)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as Payable[];
    },
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id,name,bank,color")
        .eq("status", "ativa")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string }[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let rows = (data ?? []).slice();
    if (fDateFrom) rows = rows.filter(p => p.due_date >= fDateFrom);
    if (fDateTo) rows = rows.filter(p => p.due_date <= fDateTo);
    if (fSupplier !== "__all__") rows = rows.filter(p => (p.supplier_id ?? "__none__") === fSupplier);
    if (fCategory !== "__all__") rows = rows.filter(p => p.category === fCategory);
    if (fStatus !== "__all__") {
      if (fStatus === "atrasado") rows = rows.filter(p => p.status === "pendente" && p.due_date < today);
      else rows = rows.filter(p => p.status === fStatus);
    }
    if (fSearch.trim()) {
      const q = fSearch.toLowerCase();
      rows = rows.filter(p => p.description.toLowerCase().includes(q));
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: any, bv: any;
      switch (sort.key) {
        case "due_date": av = a.due_date; bv = b.due_date; break;
        case "description": av = a.description; bv = b.description; break;
        case "supplier": av = a.suppliers?.name ?? ""; bv = b.suppliers?.name ?? ""; break;
        case "category": av = a.category; bv = b.category; break;
        case "status": av = a.status; bv = b.status; break;
        case "amount": av = Number(a.amount); bv = Number(b.amount); break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [data, fDateFrom, fDateTo, fSupplier, fCategory, fStatus, fSearch, sort, today]);

  const totals = useMemo(() => {
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7s = in7.toISOString().slice(0, 10);
    const pending = filtered.filter(p => p.status === "pendente");
    const overdue = pending.filter(p => p.due_date < today);
    const paidPeriod = filtered.filter(p => p.status === "pago");
    const next7 = filtered.filter(p => p.status === "pendente" && p.due_date >= today && p.due_date <= in7s);
    return {
      pendingAmount: pending.reduce((s, p) => s + Number(p.amount), 0),
      overdueCount: overdue.length,
      paidPeriodAmount: paidPeriod.reduce((s, p) => s + Number(p.paid_amount || p.amount), 0),
      totalAmount: filtered.reduce((s, p) => s + Number(p.amount), 0),
      next7Amount: next7.reduce((s, p) => s + Number(p.amount), 0),
      count: filtered.length,
    };
  }, [filtered, today]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, { label: string; items: Payable[]; sortKey: string }>();
    for (const p of filtered) {
      let key: string, label: string, sortKey: string;
      if (groupBy === "month") {
        key = p.due_date.slice(0, 7);
        const [y, m] = key.split("-");
        label = `${MONTH_NAMES[Number(m) - 1]}/${y}`;
        sortKey = key;
      } else if (groupBy === "supplier") {
        key = p.supplier_id ?? "__none__";
        label = p.suppliers?.name ?? "Sem fornecedor";
        sortKey = label.toLowerCase();
      } else {
        key = p.category;
        label = p.category;
        sortKey = key;
      }
      if (!map.has(key)) map.set(key, { label, items: [], sortKey });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v, subtotal: v.items.reduce((s, p) => s + Number(p.amount), 0) }))
      .sort((a, b) => a.sortKey < b.sortKey ? -1 : 1);
  }, [filtered, groupBy]);

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("payables").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables"] }); toast.success("Removido"); },
  });

  const { page, setPage, totalPages, total, pageItems } = usePagination(filtered);

  const toggleSort = (key: SortKey) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };

  const SortableHead = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: "right" }) => (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
        {children}
        <ArrowUpDown className={`size-3 ${sort.key === k ? "text-foreground" : "opacity-40"}`} />
      </button>
    </TableHead>
  );

  const { data: allCats } = useCategoriasContasPagar();
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (allCats ?? []).forEach(c => set.add(c.nome));
    (data ?? []).forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allCats, data]);

  const periodLabel = () => {
    if (preset === "today") return "hoje";
    if (preset === "week") return "semana";
    if (preset === "month") return "mes";
    if (preset === "next30") return "prox30dias";
    if (preset === "next90") return "prox3meses";
    if (fDateFrom || fDateTo) return `${fDateFrom || "inicio"}_a_${fDateTo || "fim"}`;
    return "todos";
  };

  const exportXlsx = () => {
    const rows: any[] = filtered.map(p => ({
      Vencimento: p.due_date,
      Descrição: p.description,
      Fornecedor: p.suppliers?.name ?? "",
      Categoria: p.category,
      Status: p.status === "pendente" && p.due_date < today ? "atrasado" : p.status,
      Valor: Number(p.amount),
    }));
    rows.push({ Vencimento: "", Descrição: "TOTAL", Fornecedor: "", Categoria: "", Status: "", Valor: totals.totalAmount });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, `contas_pagar_${periodLabel()}.xlsx`);
  };

  const renderRow = (p: Payable) => {
    const overdue = p.status === "pendente" && p.due_date < today;
    return (
      <TableRow key={p.id}>
        <TableCell className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
          <InlineDate value={p.due_date} onSave={async (v) => {
            const { error } = await supabase.from("payables").update({ due_date: v }).eq("id", p.id);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["payables"] });
          }} />
        </TableCell>
        <TableCell className="font-medium">
          <InlineText value={p.description} onSave={async (v) => {
            if (!v.trim()) throw new Error("Descrição obrigatória");
            const { error } = await supabase.from("payables").update({ description: v.trim() }).eq("id", p.id);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["payables"] });
          }} />
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">{p.suppliers?.name ?? "—"}</TableCell>
        <TableCell className="capitalize text-muted-foreground text-sm">{p.category}</TableCell>
        <TableCell><StatusBadge status={overdue ? "atrasado" : p.status} /></TableCell>
        <TableCell className="text-right font-medium">
          <InlineNumber value={Number(p.amount)} onSave={async (v) => {
            if (v <= 0) throw new Error("Informe um valor maior que zero");
            const { error } = await supabase.from("payables").update({ amount: v }).eq("id", p.id);
            if (error) throw error;
            qc.invalidateQueries({ queryKey: ["payables"] });
          }} />
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditTarget(p)}>
            <Pencil className="size-4" />
          </Button>
          {p.status !== "pago" && p.status !== "cancelado" && (
            <Button variant="ghost" size="icon" title="Marcar como pago" onClick={() => setPayTarget(p)}>
              <CheckCircle2 className="size-4 text-success" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={async () => {
            if (await confirm({ title: "Excluir conta?", description: `A conta "${p.description}" será removida permanentemente.` })) remove.mutate(p.id);
          }}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  const footerTotalPending = filtered.filter(p => p.status === "pendente").reduce((s, p) => s + Number(p.amount), 0);
  const footerTotalPaid = filtered.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.paid_amount || p.amount), 0);


  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Contas a pagar"
        subtitle="Despesas, fornecedores e compromissos"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowHelp(true)}>
              <HelpCircle className="size-4 mr-1" /> Como funciona esta etapa
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-primary-foreground"><Plus className="size-4 mr-1" /> Nova conta</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Nova conta a pagar</DialogTitle></DialogHeader>
                <PayableForm
                  suppliers={suppliers ?? []}
                  bankAccounts={bankAccounts ?? []}
                  onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["payables"] }); }}
                />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display">{brl(totals.pendingAmount)}</div>
          <div className="text-xs text-muted-foreground mt-1">Em aberto</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display text-destructive">{totals.overdueCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Em atraso</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display">{brl(totals.paidPeriodAmount)}</div>
          <div className="text-xs text-muted-foreground mt-1">Pago no período</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display">{brl(totals.totalAmount)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total do período</div>
        </CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5">
          <div className="text-2xl font-display">{brl(totals.next7Amount)}</div>
          <div className="text-xs text-muted-foreground mt-1">Vence em 7 dias</div>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {([
              ["all", "Todos"], ["today", "Hoje"], ["week", "Esta semana"], ["month", "Este mês"],
              ["next30", "Próximos 30 dias"], ["next90", "Próximos 3 meses"], ["custom", "Personalizado"],
            ] as [PeriodPreset, string][]).map(([k, l]) => (
              <Button key={k} size="sm" variant={preset === k ? "default" : "outline"} onClick={() => applyPreset(k)}>{l}</Button>
            ))}
            {preset === "custom" && (
              <>
                <Input type="date" className="w-auto" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} />
                <Input type="date" className="w-auto" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} />
              </>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Buscar descrição</Label>
              <Input value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Buscar…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={fSupplier} onValueChange={setFSupplier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="__none__">Sem fornecedor</SelectItem>
                  {(suppliers ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Categoria</Label>
                <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                  <Link to="/configuracoes/categorias"><Settings className="size-3 mr-1" />Categorias</Link>
                </Button>
              </div>
              <Select value={fCategory} onValueChange={setFCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {categoryOptions.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Agrupar por</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem agrupamento</SelectItem>
                  <SelectItem value="month">Por mês</SelectItem>
                  <SelectItem value="supplier">Por fornecedor</SelectItem>
                  <SelectItem value="category">Por categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="size-4 mr-1" />Exportar Excel</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead k="due_date">Vencimento</SortableHead>
                <SortableHead k="description">Descrição</SortableHead>
                <SortableHead k="supplier">Fornecedor</SortableHead>
                <SortableHead k="category">Categoria</SortableHead>
                <SortableHead k="status">Status</SortableHead>
                <SortableHead k="amount" align="right">Valor</SortableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma conta encontrada.</TableCell></TableRow>
              )}
              {grouped === null && pageItems.map(renderRow)}
              {grouped !== null && grouped.map(g => {
                const isCollapsed = collapsed[g.key];
                return (
                  <React.Fragment key={g.key}>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={7}>
                        <button className="inline-flex items-center gap-2 font-medium" onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}>
                          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                          <span className="capitalize">{g.label}</span>
                          <span className="text-muted-foreground text-xs">({g.items.length} · {brl(g.subtotal)})</span>
                        </button>
                      </TableCell>
                    </TableRow>
                    {!isCollapsed && g.items.map(renderRow)}
                    {!isCollapsed && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-right text-xs text-muted-foreground">Subtotal</TableCell>
                        <TableCell className="text-right font-medium">{brl(g.subtotal)}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          <div className="border-t p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm bg-muted/30">
            <div><span className="text-muted-foreground">Lançamentos:</span> <strong>{totals.count}</strong></div>
            <div><span className="text-muted-foreground">Total filtrado:</span> <strong>{brl(totals.totalAmount)}</strong></div>
            <div><span className="text-muted-foreground">Pendente:</span> <strong>{brl(footerTotalPending)}</strong></div>
            <div><span className="text-muted-foreground">Pago:</span> <strong>{brl(footerTotalPaid)}</strong></div>
          </div>
          {grouped === null && <DataPagination page={page} totalPages={totalPages} total={total} onChange={setPage} />}
        </CardContent>
      </Card>


      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Registrar pagamento</DialogTitle></DialogHeader>
          {payTarget && (
            <PayPayableForm
              payable={payTarget}
              bankAccounts={bankAccounts ?? []}
              onDone={() => {
                setPayTarget(null);
                qc.invalidateQueries({ queryKey: ["payables"] });
                qc.invalidateQueries({ queryKey: ["finance"] });
                qc.invalidateQueries({ queryKey: ["bank-movements"] });
                qc.invalidateQueries({ queryKey: ["dashboard"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">Editar conta a pagar</DialogTitle></DialogHeader>
          {editTarget && (
            <EditPayableForm
              payable={editTarget}
              all={data ?? []}
              suppliers={suppliers ?? []}
              bankAccounts={bankAccounts ?? []}
              onDone={() => { setEditTarget(null); qc.invalidateQueries({ queryKey: ["payables"] }); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💰 Contas a Pagar — Controle de Compromissos Financeiros</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo desta etapa</h3>
              <p className="text-muted-foreground">
                O módulo Contas a Pagar é responsável por controlar todas as obrigações financeiras da empresa, permitindo acompanhar vencimentos, pagamentos, despesas recorrentes e compromissos assumidos com fornecedores e prestadores de serviços.
              </p>
              <p className="text-muted-foreground mt-2">
                Garante organização financeira, evita atrasos, mantém o fluxo de caixa equilibrado e fornece informações confiáveis para o planejamento financeiro.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">📌 O que pode ser feito</h3>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Registrar novas contas a pagar</li>
                <li>Consultar contas cadastradas</li>
                <li>Editar informações quando necessário</li>
                <li>Acompanhar vencimentos</li>
                <li>Controlar contas pagas, pendentes e em atraso</li>
                <li>Filtrar por fornecedor, categoria e status</li>
                <li>Agrupar informações para análise</li>
                <li>Exportar os dados para Excel</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">🔄 Fluxo recomendado</h3>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li><b>Registrar uma nova conta</b> — clique em ➕ Nova conta e informe descrição, fornecedor, categoria, valor, vencimento, condição de pagamento e observações.</li>
                <li><b>Classificar corretamente</b> — selecione a categoria adequada (Energia, Água, Internet, Telefonia, Impostos, Fretes, Cartões, Serviços, Fornecedores, Outras despesas).</li>
                <li><b>Acompanhar vencimentos</b> — utilize os indicadores superiores para visualizar contas em aberto, em atraso, pagas, total do período e próximos vencimentos.</li>
                <li><b>Utilizar filtros</b> — localize rapidamente por período, fornecedor, categoria, status e agrupamento.</li>
                <li><b>Atualizar o status</b> — após a quitação, atualize a conta para manter financeiro, fluxo de caixa e indicadores refletindo a realidade.</li>
              </ol>
            </section>

            <section>
              <h3 className="font-semibold mb-1">🎯 Objetivo do resultado</h3>
              <p className="text-muted-foreground mb-1">Controle completo das obrigações financeiras permitindo controlar vencimentos, evitar atrasos, acompanhar pagamentos, analisar despesas, planejar o fluxo de caixa e gerar indicadores confiáveis. Alimenta automaticamente:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Financeiro</li>
                <li>Fluxo de Caixa</li>
                <li>Business Intelligence (BI)</li>
                <li>Despesas Anuais</li>
                <li>Relatórios Gerenciais</li>
                <li>Indicadores Financeiros</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">✅ Boas práticas</h3>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                <li>Registrar todas as obrigações financeiras</li>
                <li>Conferir valores antes da confirmação</li>
                <li>Atualizar imediatamente contas quitadas</li>
                <li>Classificar corretamente as categorias</li>
                <li>Revisar periodicamente contas em atraso</li>
                <li>Utilizar filtros para auditorias financeiras</li>
                <li>Exportar relatórios sempre que necessário</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-1">⚠️ Importante</h3>
              <p className="text-muted-foreground">
                As informações registradas impactam diretamente o Fluxo de Caixa, Indicadores Financeiros, BI, Planejamento Financeiro e Relatórios Gerenciais. Manter este módulo atualizado garante maior precisão na gestão financeira da empresa.
              </p>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Inline edit components =====

function InlineText({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setV(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (!editing) return <span className="cursor-pointer hover:underline decoration-dotted" onClick={() => setEditing(true)}>{value || <em className="text-muted-foreground">(sem descrição)</em>}</span>;
  return (
    <Input
      ref={ref}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") { try { await onSave(v); setEditing(false); toast.success("Salvo"); } catch (err: any) { toast.error(err.message); } }
        if (e.key === "Escape") { setV(value); setEditing(false); }
      }}
      onBlur={() => { setV(value); setEditing(false); }}
      className="h-8"
    />
  );
}

function InlineNumber({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setV(String(value)); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (!editing) return <span className="cursor-pointer hover:underline decoration-dotted" onClick={() => setEditing(true)}>{brl(value)}</span>;
  return (
    <Input
      ref={ref}
      type="number"
      step="0.01"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") { try { await onSave(Number(v)); setEditing(false); toast.success("Salvo"); } catch (err: any) { toast.error(err.message); } }
        if (e.key === "Escape") { setV(String(value)); setEditing(false); }
      }}
      onBlur={() => { setV(String(value)); setEditing(false); }}
      className="h-8 text-right"
    />
  );
}

function InlineDate({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setV(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (!editing) return <span className="cursor-pointer hover:underline decoration-dotted" onClick={() => setEditing(true)}>{new Date(value + "T00:00").toLocaleDateString("pt-BR")}</span>;
  return (
    <Input
      ref={ref}
      type="date"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") { try { await onSave(v); setEditing(false); toast.success("Salvo"); } catch (err: any) { toast.error(err.message); } }
        if (e.key === "Escape") { setV(value); setEditing(false); }
      }}
      onBlur={() => { setV(value); setEditing(false); }}
      className="h-8"
    />
  );
}

// ===== Edit Form =====

function EditPayableForm({ payable, all, suppliers, bankAccounts, onDone }: { payable: Payable; all: Payable[]; suppliers: { id: string; name: string }[]; bankAccounts: { id: string; name: string; bank: string; color: string }[]; onDone: () => void }) {
  const series = useMemo(() => findSeriesItems(all, payable), [all, payable]);
  const [scope, setScope] = useState<"one" | "forward" | "all">("one");
  const navCats = useNavigate();
  const { data: cats } = useCategoriasContasPagar();
  const categoryOptions = (cats && cats.length > 0) ? cats.map(c => c.nome) : FALLBACK_CATEGORIES;

  const [f, setF] = useState({
    supplier_id: payable.supplier_id ?? "",
    description: payable.description,
    category: payable.category,
    amount: Number(payable.amount),
    due_date: payable.due_date,
    payment_method: payable.payment_method ?? "pix",
    bank_account_id: payable.bank_account_id ?? "",
    recurrence: payable.recurrence,
  });

  const addMonths = (iso: string, n: number) => { const [y,m,d] = iso.split("-").map(Number); return new Date(y, m - 1 + n, d).toISOString().slice(0,10); };
  const addWeeks = (iso: string, n: number) => { const dt = new Date(iso + "T00:00"); dt.setDate(dt.getDate() + 7 * n); return dt.toISOString().slice(0, 10); };

  const save = useMutation({
    mutationFn: async () => {
      if (f.amount <= 0) throw new Error("Informe um valor maior que zero");
      if (!f.description.trim()) throw new Error("Descrição obrigatória");

      // Single-row update (no series, or scope === "one")
      if (!series || scope === "one") {
        // Preserve series suffix in description if exists
        let desc = f.description.trim();
        const s = parseSeries(payable.description);
        const newHasSuffix = parseSeries(desc);
        if (s && !newHasSuffix) desc = `${desc} (${s.index}/${s.total})`;
        const { error } = await supabase.from("payables").update({
          supplier_id: f.supplier_id || null,
          description: desc,
          category: f.category,
          amount: f.amount,
          due_date: f.due_date,
          payment_method: f.payment_method,
          bank_account_id: f.bank_account_id || null,
          recurrence: f.recurrence,
        } as any).eq("id", payable.id);
        if (error) throw error;
        return 1;
      }

      // Series bulk update
      const cur = parseSeries(payable.description)!;
      const dueChanged = f.due_date !== payable.due_date;
      const targets = series.items.filter(it => scope === "all" ? true : it._idx >= cur.index);

      // Strip series suffix the user may have left in description
      const baseDesc = (parseSeries(f.description.trim())?.base ?? f.description.trim());

      let count = 0;
      for (const it of targets) {
        const itS = parseSeries(it.description)!;
        const newDesc = `${baseDesc} (${itS.index}/${itS.total})`;
        let newDue = it.due_date;
        if (dueChanged) {
          const offset = itS.index - cur.index;
          newDue = f.recurrence === "semanal" ? addWeeks(f.due_date, offset)
                : f.recurrence === "mensal" ? addMonths(f.due_date, offset)
                : addMonths(f.due_date, offset);
        }
        const { error } = await supabase.from("payables").update({
          supplier_id: f.supplier_id || null,
          description: newDesc,
          category: f.category,
          amount: f.amount,
          due_date: newDue,
          payment_method: f.payment_method,
          bank_account_id: f.bank_account_id || null,
          recurrence: f.recurrence,
        } as any).eq("id", it.id);
        if (error) throw error;
        count++;
      }
      return count;
    },
    onSuccess: (n) => { toast.success(n > 1 ? `${n} lançamentos atualizados` : "Lançamento atualizado"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      {series && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="text-sm font-medium">Este lançamento faz parte de uma série ({series.current}/{series.total}). O que deseja editar?</div>
          <RadioGroup value={scope} onValueChange={(v: any) => setScope(v)} className="space-y-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="one" /> Somente este lançamento
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="forward" /> Este e todos os próximos
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="all" /> Todos os lançamentos da série
            </label>
          </RadioGroup>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Descrição</Label>
          <Input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Fornecedor</Label>
          <Select value={f.supplier_id || "__none__"} onValueChange={(v) => setF({ ...f, supplier_id: v === "__none__" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem fornecedor</SelectItem>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={f.category} onValueChange={(v) => { if (v === "__manage__") { navCats({ to: "/configuracoes/categorias" }); return; } setF({ ...f, category: v }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categoryOptions.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              {!categoryOptions.includes(f.category) && <SelectItem value={f.category} className="capitalize">{f.category}</SelectItem>}
              <SelectItem value="__manage__">⚙️ Gerenciar categorias…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" required min={0.01} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Vencimento</Label>
          <Input type="date" required value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Conta bancária de pagamento</Label>
          <Select value={f.bank_account_id || "__none__"} onValueChange={(v) => setF({ ...f, bank_account_id: v === "__none__" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Não definir agora</SelectItem>
              {bankAccounts.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: b.color }} />
                    {b.name} <span className="text-muted-foreground">— {b.bank}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Recorrência</Label>
          <Select value={f.recurrence} onValueChange={(v: any) => setF({ ...f, recurrence: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhuma">Não se repete</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={save.isPending} className="bg-gradient-primary text-primary-foreground">
          {save.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PayPayableForm({ payable, bankAccounts, onDone }: { payable: Payable; bankAccounts: { id: string; name: string; bank: string; color: string }[]; onDone: () => void }) {
  const [paid_at, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [bank_account_id, setBankAccountId] = useState<string>("");
  const [amount, setAmount] = useState(Number(payable.amount));

  const save = useMutation({
    mutationFn: async () => {
      if (amount <= 0) throw new Error("Informe um valor maior que zero");
      const { error } = await supabase.from("payables").update({
        status: "pago",
        paid_amount: amount,
        paid_at: new Date(paid_at).toISOString(),
        bank_account_id: bank_account_id || null,
      } as any).eq("id", payable.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(bank_account_id ? "Pago e lançado na conta bancária" : "Pago"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{payable.description}</div>
        Valor original: {brl(Number(payable.amount))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor pago (R$)</Label>
          <Input type="number" step="0.01" min={0.01} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" required value={paid_at} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Conta bancária utilizada</Label>
          <Select value={bank_account_id || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Não vincular a uma conta</SelectItem>
              {bankAccounts.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Cadastre uma conta em "Contas bancárias"</div>
              )}
              {bankAccounts.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: b.color }} />
                    {b.name} <span className="text-muted-foreground">— {b.bank}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Confirmar pagamento"}
      </Button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente: "bg-accent text-accent-foreground",
    pago: "bg-success/15 text-success",
    atrasado: "bg-destructive/15 text-destructive",
    cancelado: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full capitalize ${map[status]}`}>
      {status === "atrasado" && <AlertCircle className="size-3" />}
      {status}
    </span>
  );
}

function PayableForm({ suppliers, onDone }: { suppliers: { id: string; name: string }[]; onDone: () => void }) {
  const confirm = useConfirm();
  const [f, setF] = useState({
    supplier_id: "", description: "", category: "fornecedor",
    amount: 0, due_date: new Date().toISOString().slice(0, 10),
    payment_method: "pix", recurrence: "nenhuma" as "nenhuma" | "semanal" | "mensal",
  });
  const [repeatCount, setRepeatCount] = useState(1);
  const navCats2 = useNavigate();
  const { data: cats } = useCategoriasContasPagar();
  const categoryOptions = (cats && cats.length > 0) ? cats.map((c) => c.nome) : FALLBACK_CATEGORIES;

  const addMonths = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1 + n, d).toISOString().slice(0, 10); };
  const addWeeks = (iso: string, n: number) => { const dt = new Date(iso + "T00:00"); dt.setDate(dt.getDate() + 7 * n); return dt.toISOString().slice(0, 10); };

  const save = useMutation({
    mutationFn: async () => {
      if (f.amount <= 0) throw new Error("Informe um valor maior que zero");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const isRecurring = f.recurrence !== "nenhuma" && repeatCount > 1;
      const total = isRecurring ? repeatCount : 1;
      const rows = Array.from({ length: total }, (_, i) => {
        const due = isRecurring
          ? (f.recurrence === "mensal" ? addMonths(f.due_date, i) : addWeeks(f.due_date, i))
          : f.due_date;
        const desc = isRecurring ? `${f.description} (${i + 1}/${total})` : f.description;
        return {
          supplier_id: f.supplier_id || null,
          description: desc,
          category: f.category,
          amount: f.amount,
          due_date: due,
          payment_method: f.payment_method,
          recurrence: f.recurrence,
          user_id: user.id,
        };
      });
      const { error } = await supabase.from("payables").insert(rows as any);
      if (error) {
        if ((error as any).code === "23505") {
          throw new Error("Já existe uma conta a pagar pendente com a mesma descrição, vencimento e valor. Verifique antes de criar novamente.");
        }
        throw error;
      }
      return total;
    },
    onSuccess: (n) => { toast.success(n > 1 ? `${n} contas criadas` : "Conta criada"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.amount <= 0) { toast.error("Informe um valor maior que zero"); return; }
    // Trava anti-duplicidade: bloquear lançamento manual de despesas de cartão
    if (/cart[aã]o/i.test(f.category)) {
      const ok = await confirm({
        title: "⚠️ Possível duplicidade de cartão de crédito",
        description:
          "Despesas de cartão de crédito devem ser lançadas no módulo Cartões de Crédito, não aqui — caso contrário, o pagamento da fatura no módulo Cartões + a baixa manual em Contas a Pagar debitam o valor em dobro do banco. Deseja continuar mesmo assim?",
        confirmText: "Continuar mesmo assim",
        cancelText: "Cancelar",
        destructive: true,
      });
      if (!ok) return;
    }
    const isRecurring = f.recurrence !== "nenhuma" && repeatCount > 1;
    if (isRecurring) {
      const ok = await confirm({
        title: "Confirmar criação",
        description: `Serão criadas ${repeatCount} contas a pagar no total. Confirmar?`,
        confirmText: "Criar",
        destructive: false,
      });
      if (!ok) return;
    }
    save.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Descrição</Label>
          <Input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Fornecedor</Label>
          <Select
            value={f.supplier_id || "__none__"}
            onValueChange={(v) => {
              if (v === "__none__") setF({ ...f, supplier_id: "" });
              else {
                const sup = suppliers.find((s) => s.id === v);
                setF({ ...f, supplier_id: v, description: sup && !f.description ? sup.name : (sup ? sup.name : f.description) });
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Opcional — sem fornecedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem fornecedor (opcional)</SelectItem>
              {suppliers.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum fornecedor cadastrado</div>}
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={f.category} onValueChange={(v) => { if (v === "__manage__") { navCats2({ to: "/configuracoes/categorias" }); return; } setF({ ...f, category: v }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categoryOptions.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              <SelectItem value="__manage__">⚙️ Gerenciar categorias…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" required min={0.01} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Vencimento</Label>
          <Input type="date" required value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Recorrência</Label>
          <Select value={f.recurrence} onValueChange={(v: any) => setF({ ...f, recurrence: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhuma">Não se repete</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {f.recurrence !== "nenhuma" && (
          <div className="space-y-1.5">
            <Label>Repetir por quantos {f.recurrence === "mensal" ? "meses" : "semanas"}?</Label>
            <Input type="number" min={1} max={60} value={repeatCount} onChange={(e) => setRepeatCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
            <div className="text-xs text-muted-foreground">Serão criadas {repeatCount} {repeatCount === 1 ? "conta" : "contas"} no total.</div>
          </div>
        )}
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
        {save.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
