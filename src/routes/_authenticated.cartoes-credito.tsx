import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { brl, dateBR } from "@/lib/format";
import { toast } from "sonner";
import { Plus, CreditCard as CCIcon, Fuel, Home, User, AlertTriangle, Clock, CheckCircle2, Pencil, Trash2, Factory } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/cartoes-credito")({
  head: () => ({ meta: [{ title: "Cartões de Crédito — Rosé" }] }),
  component: CartoesPage,
});

type Cartao = {
  id: string;
  nome: string;
  bandeira: string;
  limite_total: number;
  dia_vencimento: number;
  dia_fechamento: number;
  cor: string;
  conta_bancaria_id: string | null;
  status: string;
};

type Lancamento = {
  id: string;
  cartao_id: string;
  data: string;
  descricao: string;
  categoria: "combustivel" | "casa" | "pessoal" | "fornecedores";
  valor: number;
  parcelado: boolean;
  total_parcelas: number;
  parcela_atual: number;
  grupo_parcela: string | null;
  mes_fatura: number;
  ano_fatura: number;
  observacoes: string | null;
};

type Fatura = {
  id: string;
  cartao_id: string;
  mes: number;
  ano: number;
  valor_total: number;
  status: string;
  data_pagamento: string | null;
};

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];
const COR_DEFAULTS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

type CatKey = "combustivel" | "casa" | "pessoal" | "fornecedores";
const CAT_KEYS: CatKey[] = ["combustivel", "casa", "pessoal", "fornecedores"];

const CAT_META = {
  combustivel: { label: "Combustível", icon: Fuel, color: "#3b82f6", emoji: "🚗" },
  casa: { label: "Casa", icon: Home, color: "#10b981", emoji: "🏠" },
  pessoal: { label: "Pessoal", icon: User, color: "#ec4899", emoji: "👤" },
  fornecedores: { label: "Fornecedores", icon: Factory, color: "#F97316", emoji: "🏭" },
} as const;

function computeFatura(dataISO: string, diaFechamento: number) {
  const d = new Date(dataISO + "T00:00:00");
  const day = d.getDate();
  let mes = d.getMonth() + 1;
  let ano = d.getFullYear();
  if (day > diaFechamento) {
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return { mes, ano };
}

function vencimentoDate(ano: number, mes: number, diaVenc: number) {
  const last = new Date(ano, mes, 0).getDate();
  return new Date(ano, mes - 1, Math.min(diaVenc, last));
}

function CartoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("geral");
  const [openCartao, setOpenCartao] = useState(false);
  const [openLanc, setOpenLanc] = useState(false);

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes_credito"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("cartoes_credito" as any).select("*").order("created_at"));
      if (error) throw error;
      return (data ?? []) as unknown as Cartao[];
    },
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ["cartoes_lancamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("cartoes_lancamentos" as any).select("*").order("data", { ascending: false }));
      if (error) throw error;
      return (data ?? []) as unknown as Lancamento[];
    },
  });

  const { data: faturas = [] } = useQuery({
    queryKey: ["cartoes_faturas"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("cartoes_faturas" as any).select("*"));
      if (error) throw error;
      return (data ?? []) as unknown as Fatura[];
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["bank_accounts_simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("id,name").eq("status", "ativa");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const today = new Date();
  const curMes = today.getMonth() + 1;
  const curAno = today.getFullYear();

  const lancByCartao = useMemo(() => {
    const m: Record<string, Lancamento[]> = {};
    for (const l of lancamentos) (m[l.cartao_id] ??= []).push(l);
    return m;
  }, [lancamentos]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cartoes_credito"] });
    qc.invalidateQueries({ queryKey: ["cartoes_lancamentos"] });
    qc.invalidateQueries({ queryKey: ["cartoes_faturas"] });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Cartões de Crédito" subtitle="Gestão de cartões com categorias Combustível, Casa e Pessoal" />

      <div className="flex flex-wrap gap-2 mb-6">
        <Dialog open={openCartao} onOpenChange={setOpenCartao}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="size-4 mr-1" /> Novo cartão
            </Button>
          </DialogTrigger>
          <CartaoDialog contas={contas} userId={user?.id ?? ""} onDone={() => { setOpenCartao(false); invalidate(); }} />
        </Dialog>
        <Dialog open={openLanc} onOpenChange={setOpenLanc}>
          <DialogTrigger asChild>
            <Button disabled={cartoes.length === 0}>
              <Plus className="size-4 mr-1" /> Novo lançamento
            </Button>
          </DialogTrigger>
          <LancDialog cartoes={cartoes} userId={user?.id ?? ""} onDone={() => { setOpenLanc(false); invalidate(); }} />
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="cartoes">Meus Cartões</TabsTrigger>
          <TabsTrigger value="historico">Histórico Mensal</TabsTrigger>
          {cartoes.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>{c.nome}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <VisaoGeral cartoes={cartoes} lancamentos={lancamentos} faturas={faturas} curMes={curMes} curAno={curAno} />
        </TabsContent>

        <TabsContent value="cartoes" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[80vh] overflow-y-auto pr-1">
            {cartoes.length === 0 && (
              <Card className="shadow-soft col-span-full"><CardContent className="p-8 text-center text-muted-foreground">
                Nenhum cartão cadastrado. Clique em "Novo cartão" para começar.
              </CardContent></Card>
            )}
            {cartoes.map((c) => (
              <CartaoCard key={c.id} cartao={c} contas={contas} lancamentos={lancByCartao[c.id] ?? []} faturas={faturas.filter((f) => f.cartao_id === c.id)} curMes={curMes} curAno={curAno} onClick={() => setTab(c.id)} onPaga={invalidate} onChanged={invalidate} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoMensal cartoes={cartoes} lancamentos={lancamentos} />
        </TabsContent>

        {cartoes.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-4">
            <CartaoDetalhe cartao={c} lancamentos={lancByCartao[c.id] ?? []} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CartaoCard({ cartao, contas, lancamentos, faturas, curMes, curAno, onClick, onPaga, onChanged }: {
  cartao: Cartao; contas: { id: string; name: string }[]; lancamentos: Lancamento[]; faturas: Fatura[]; curMes: number; curAno: number;
  onClick: () => void; onPaga: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const usado = lancamentos.filter((l) => l.mes_fatura === curMes && l.ano_fatura === curAno).reduce((s, l) => s + Number(l.valor), 0);
  const disp = Math.max(0, Number(cartao.limite_total) - usado);
  const pct = cartao.limite_total > 0 ? Math.min(100, (usado / cartao.limite_total) * 100) : 0;
  const catTotals = CAT_KEYS.map((k) => ({
    k, total: lancamentos.filter((l) => l.mes_fatura === curMes && l.ano_fatura === curAno && l.categoria === k).reduce((s, l) => s + Number(l.valor), 0),
  }));

  const vencDate = vencimentoDate(curAno, curMes, cartao.dia_vencimento);
  const diasVenc = Math.ceil((vencDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const fat = faturas.find((f) => f.mes === curMes && f.ano === curAno);
  const status: "aberta" | "fechada" | "paga" | "atrasada" =
    fat?.status === "paga" ? "paga"
    : diasVenc < 0 && usado > 0 ? "atrasada"
    : new Date().getDate() > cartao.dia_fechamento ? "fechada" : "aberta";

  const marcarPaga = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("cartoes_faturas" as any).upsert({
        cartao_id: cartao.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        mes: curMes, ano: curAno, valor_total: usado, status: "paga",
        data_pagamento: new Date().toISOString().slice(0, 10),
      }, { onConflict: "cartao_id,ano,mes" }));
      if (error) throw error;
      if (cartao.conta_bancaria_id && usado > 0) {
        await supabase.from("bank_movements").insert({
          user_id: (await supabase.auth.getUser()).data.user!.id,
          account_id: cartao.conta_bancaria_id,
          movement_date: new Date().toISOString().slice(0, 10),
          type: "saida",
          category: "Cartão de crédito",
          description: `Fatura ${cartao.nome} — ${String(curMes).padStart(2, "0")}/${curAno}`,
          amount: usado,
          origin: "cartao_fatura",
          reference_id: cartao.id,
        });
      }
    },
    onSuccess: () => { toast.success("Fatura paga"); qc.invalidateQueries({ queryKey: ["cartoes_faturas"] }); onPaga(); },
    onError: (e: any) => toast.error(e.message),
  });

  const alertaLimite = pct >= 80;
  const alertaVenc = diasVenc >= 0 && diasVenc <= 5 && status !== "paga";
  const alertaAtraso = status === "atrasada";

  return (
    <Card className="shadow-soft overflow-hidden">
      <div className="p-5 text-white cursor-pointer" style={{ background: `linear-gradient(135deg, ${cartao.cor}, ${cartao.cor}dd)` }} onClick={onClick}>
        <div className="flex items-center justify-between">
          <CCIcon className="size-6" />
          <span className="text-xs font-medium uppercase">{cartao.bandeira}</span>
        </div>
        <div className="font-display text-xl mt-6">{cartao.nome}</div>
        <div className="text-xs opacity-80 mt-1">Venc. dia {cartao.dia_vencimento} · Fecha dia {cartao.dia_fechamento}</div>
      </div>
      <CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="text-muted-foreground">Limite</div><div className="font-medium">{brl(cartao.limite_total)}</div></div>
          <div><div className="text-muted-foreground">Usado</div><div className="font-medium text-destructive">{brl(usado)}</div></div>
          <div><div className="text-muted-foreground">Disponível</div><div className="font-medium text-success">{brl(disp)}</div></div>
        </div>
        <div>
          <Progress value={pct} className={`h-2 transition-all ${alertaLimite ? "[&>div]:bg-destructive" : ""}`} />
          <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}% utilizado</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {catTotals.map(({ k, total }) => {
            const m = CAT_META[k];
            const Icon = m.icon;
            return (
              <div key={k} className="rounded-md border p-2">
                <div className="flex items-center gap-1 text-muted-foreground"><Icon className="size-3" style={{ color: m.color }} /> {m.label}</div>
                <div className="font-medium mt-0.5">{brl(total)}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs">
            {status === "paga" ? <Badge className="bg-success">Paga</Badge>
              : status === "atrasada" ? <Badge variant="destructive">Atrasada</Badge>
              : status === "fechada" ? <Badge variant="secondary">Fechada</Badge>
              : <Badge variant="outline">Aberta</Badge>}
            <div className="text-muted-foreground mt-1">
              {status === "paga" ? `Paga em ${fat?.data_pagamento ? dateBR(fat.data_pagamento) : "-"}`
                : diasVenc >= 0 ? `Vence em ${diasVenc} dias — ${brl(usado)}` : `Venceu há ${Math.abs(diasVenc)} dias`}
            </div>
          </div>
          {status !== "paga" && usado > 0 && (
            <Button size="sm" variant="outline" onClick={() => marcarPaga.mutate()} disabled={marcarPaga.isPending}>
              <CheckCircle2 className="size-3 mr-1" /> Pagar
            </Button>
          )}
        </div>
        {(alertaLimite || alertaVenc || alertaAtraso) && (
          <div className="space-y-1 pt-2 border-t">
            {alertaLimite && <div className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> Limite acima de 80%</div>}
            {alertaVenc && <div className="flex items-center gap-1 text-xs text-amber-600"><Clock className="size-3" /> Vence em {diasVenc} dia(s)</div>}
            {alertaAtraso && <div className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> Fatura vencida</div>}
          </div>
        )}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3 mr-1" /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={async () => {
              const ok = await confirm({
                title: "Excluir cartão",
                description: "Excluir este cartão irá remover todos os lançamentos vinculados. Confirmar?",
                confirmText: "Excluir cartão",
                destructive: true,
              });
              if (!ok) return;
              const { error } = await (supabase.from("cartoes_credito" as any).delete().eq("id", cartao.id));
              if (error) { toast.error(error.message); return; }
              toast.success("Cartão excluído");
              onChanged();
            }}
          >
            <Trash2 className="size-3 mr-1" /> Excluir
          </Button>
        </div>
      </CardContent>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <CartaoDialog contas={contas} userId={cartao.id /* unused on edit */} cartao={cartao} onDone={() => { setEditOpen(false); onChanged(); }} />
      </Dialog>
    </Card>
  );
}

function CartaoDialog({ contas, userId, cartao, onDone }: { contas: { id: string; name: string }[]; userId: string; cartao?: Cartao; onDone: () => void }) {
  const isEdit = !!cartao;
  const [f, setF] = useState({
    nome: cartao?.nome ?? "",
    bandeira: cartao?.bandeira ?? "Visa",
    limite_total: cartao?.limite_total != null ? String(cartao.limite_total) : "",
    dia_vencimento: String(cartao?.dia_vencimento ?? 10),
    dia_fechamento: String(cartao?.dia_fechamento ?? 1),
    cor: cartao?.cor ?? COR_DEFAULTS[0],
    conta_bancaria_id: cartao?.conta_bancaria_id ?? "",
    status: cartao?.status ?? "ativo",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!f.nome) throw new Error("Informe o nome");
      const payload = {
        nome: f.nome, bandeira: f.bandeira,
        limite_total: Number(f.limite_total) || 0,
        dia_vencimento: Number(f.dia_vencimento),
        dia_fechamento: Number(f.dia_fechamento),
        cor: f.cor,
        conta_bancaria_id: f.conta_bancaria_id || null,
        status: f.status,
      };
      if (isEdit) {
        const { error } = await (supabase.from("cartoes_credito" as any).update(payload).eq("id", cartao!.id));
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("cartoes_credito" as any).insert({ user_id: userId, ...payload }));
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "Cartão atualizado" : "Cartão criado"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{isEdit ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nubank Roxinho" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bandeira</Label>
            <Select value={f.bandeira} onValueChange={(v) => setF({ ...f, bandeira: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BANDEIRAS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Limite total</Label><Input type="number" step="0.01" value={f.limite_total} onChange={(e) => setF({ ...f, limite_total: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={f.dia_vencimento} onChange={(e) => setF({ ...f, dia_vencimento: e.target.value })} /></div>
          <div><Label>Dia fechamento</Label><Input type="number" min={1} max={31} value={f.dia_fechamento} onChange={(e) => setF({ ...f, dia_fechamento: e.target.value })} /></div>
        </div>
        <div>
          <Label>Cor</Label>
          <div className="flex gap-2 mt-1">
            {COR_DEFAULTS.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, cor: c })} className={`size-8 rounded-full border-2 ${f.cor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        <div><Label>Conta bancária vinculada (opcional)</Label>
          <Select value={f.conta_bancaria_id || "none"} onValueChange={(v) => setF({ ...f, conta_bancaria_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhuma —</SelectItem>
              {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

function LancDialog({ cartoes, userId, onDone }: { cartoes: Cartao[]; userId: string; onDone: () => void }) {
  const ativos = cartoes.filter((c) => c.status === "ativo");
  const [f, setF] = useState({
    cartao_id: ativos[0]?.id ?? "",
    data: new Date().toISOString().slice(0, 10),
    descricao: "", categoria: "pessoal" as CatKey,
    valor: "", parcelado: false, total_parcelas: 2, observacoes: "",
  });

  const cartao = cartoes.find((c) => c.id === f.cartao_id);
  const valorNum = Number(f.valor) || 0;
  const valorParcela = f.parcelado && f.total_parcelas > 0 ? valorNum / f.total_parcelas : valorNum;

  const save = useMutation({
    mutationFn: async () => {
      if (!cartao) throw new Error("Selecione um cartão");
      if (!f.descricao) throw new Error("Informe a descrição");
      if (valorNum <= 0) throw new Error("Valor inválido");
      const parcelas = f.parcelado ? Math.max(2, Math.min(24, f.total_parcelas)) : 1;
      const grupo = f.parcelado ? crypto.randomUUID() : null;
      const rows: any[] = [];
      const valorPorParcela = valorNum / parcelas;
      const baseFat = computeFatura(f.data, cartao.dia_fechamento);
      console.log("[cartao-lancamento] cartao_id:", cartao.id, "data:", f.data, "fatura:", `${String(baseFat.mes).padStart(2,"0")}/${baseFat.ano}`, "parcelas:", parcelas);
      for (let i = 0; i < parcelas; i++) {
        let mes = baseFat.mes + i, ano = baseFat.ano;
        while (mes > 12) { mes -= 12; ano += 1; }
        rows.push({
          user_id: userId,
          cartao_id: cartao.id,
          data: f.data,
          descricao: parcelas > 1 ? `${f.descricao} (${i + 1}/${parcelas})` : f.descricao,
          categoria: f.categoria,
          valor: valorPorParcela,
          parcelado: f.parcelado,
          total_parcelas: parcelas,
          parcela_atual: i + 1,
          grupo_parcela: grupo,
          mes_fatura: mes, ano_fatura: ano,
          observacoes: f.observacoes || null,
        });
      }
      const { error } = await (supabase.from("cartoes_lancamentos" as any).insert(rows));
      if (error) { console.error("[cartao-lancamento] INSERT error:", error); throw error; }
    },
    onSuccess: () => { toast.success("Lançamento salvo"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Cartão</Label>
          <CartaoSelector cartoes={ativos} value={f.cartao_id} onChange={(v) => setF({ ...f, cartao_id: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Data</Label><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
          <div><Label>Valor</Label><Input type="number" step="0.01" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></div>
        </div>
        <div><Label>Descrição</Label><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Posto Shell" /></div>
        <div><Label>Categoria</Label>
          <Select value={f.categoria} onValueChange={(v) => setF({ ...f, categoria: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="combustivel">🚗 Combustível</SelectItem>
              <SelectItem value="casa">🏠 Casa</SelectItem>
              <SelectItem value="pessoal">👤 Pessoal</SelectItem>
              <SelectItem value="fornecedores">🏭 Fornecedores</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Parcelado?</Label>
            <Select value={f.parcelado ? "sim" : "nao"} onValueChange={(v) => setF({ ...f, parcelado: v === "sim" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="nao">Não</SelectItem><SelectItem value="sim">Sim</SelectItem></SelectContent>
            </Select>
          </div>
          {f.parcelado && (
            <div><Label>Parcelas</Label><Input type="number" min={2} max={24} value={f.total_parcelas} onChange={(e) => setF({ ...f, total_parcelas: Number(e.target.value) })} /></div>
          )}
        </div>
        {f.parcelado && valorNum > 0 && (
          <div className="text-sm text-muted-foreground">{f.total_parcelas}x de <strong>{brl(valorParcela)}</strong></div>
        )}
        <div><Label>Observações</Label><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

function CatCard({ k, valor, pct }: { k: CatKey; valor: number; pct?: number }) {
  const m = CAT_META[k];
  const Icon = m.icon;
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm" style={{ color: m.color }}><Icon className="size-4" /> {m.emoji} {m.label.toUpperCase()}</div>
        <div className="text-2xl font-display mt-2">{brl(valor)}</div>
        {pct !== undefined && <div className="text-xs text-muted-foreground">{pct.toFixed(1)}% do total</div>}
      </CardContent>
    </Card>
  );
}

function CartaoSelector({ cartoes, value, onChange }: { cartoes: Cartao[]; value: string; onChange: (v: string) => void }) {
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const selected = cartoes.find((c) => c.id === value);
  const filtered = cartoes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()));
  const grupos: Record<string, Cartao[]> = {};
  for (const c of filtered) (grupos[c.bandeira] ??= []).push(c);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
        {selected ? (
          <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-full" style={{ background: selected.cor }} />{selected.nome} <span className="text-xs text-muted-foreground">· {selected.bandeira}</span></span>
        ) : <span className="text-muted-foreground">Selecione um cartão</span>}
        <span className="text-xs">▼</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-auto">
          <div className="p-2 sticky top-0 bg-popover border-b">
            <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="h-8" />
          </div>
          {Object.keys(grupos).length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhum cartão.</div>}
          {Object.entries(grupos).map(([band, list]) => (
            <div key={band}>
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/50">{band}</div>
              {list.map((c) => (
                <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setBusca(""); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent ${c.id === value ? "bg-accent" : ""}`}>
                  <span className="inline-block size-3 rounded-full" style={{ background: c.cor }} />
                  <span className="flex-1">{c.nome}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoDetalhe({ cartao, lancamentos }: { cartao: Cartao; lancamentos: Lancamento[] }) {
  const today = new Date();
  const [mes, setMes] = useState(String(today.getMonth() + 1));
  const [ano, setAno] = useState(String(today.getFullYear()));
  const mesN = Number(mes), anoN = Number(ano);

  const filtered = lancamentos.filter((l) => l.mes_fatura === mesN && l.ano_fatura === anoN);
  const total = filtered.reduce((s, l) => s + Number(l.valor), 0);
  const disp = Math.max(0, Number(cartao.limite_total) - total);
  const catTotals = (["combustivel", "casa", "pessoal"] as const).map((k) => ({
    k, valor: filtered.filter((l) => l.categoria === k).reduce((s, l) => s + Number(l.valor), 0),
  }));
  const pieData = catTotals.map(({ k, valor }) => ({ name: CAT_META[k].label, value: valor, color: CAT_META[k].color }));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div><Label className="text-xs">Mês</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {catTotals.map(({ k, valor }) => <CatCard key={k} k={k} valor={valor} pct={total ? (valor / total) * 100 : 0} />)}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-soft md:col-span-1"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Total gasto no mês</div>
          <div className="text-2xl font-display mt-1">{brl(total)}</div>
          <div className="text-xs text-muted-foreground mt-3">Limite disponível</div>
          <div className="text-lg font-medium text-success">{brl(disp)}</div>
        </CardContent></Card>
        <Card className="shadow-soft md:col-span-2"><CardContent className="p-5">
          <div className="font-display text-lg mb-2">Distribuição por categoria</div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      </div>

      <Card className="shadow-soft"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Parcela</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem lançamentos no período.</TableCell></TableRow>}
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{dateBR(l.data)}</TableCell>
                <TableCell>{l.descricao}</TableCell>
                <TableCell>{CAT_META[l.categoria].emoji} {CAT_META[l.categoria].label}</TableCell>
                <TableCell>{l.parcelado ? `${l.parcela_atual}/${l.total_parcelas}` : "—"}</TableCell>
                <TableCell className="text-right font-medium">{brl(Number(l.valor))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

type SortKey = "nome" | "comb" | "casa" | "pess" | "tot" | "limite" | "pct" | "venc";

function VisaoGeral({ cartoes, lancamentos, faturas, curMes, curAno }: { cartoes: Cartao[]; lancamentos: Lancamento[]; faturas: Fatura[]; curMes: number; curAno: number }) {
  const [busca, setBusca] = useState("");
  const [bandeira, setBandeira] = useState("todas");
  const [statusF, setStatusF] = useState("todos");
  const [catF, setCatF] = useState("todas");
  const [sortBy, setSortBy] = useState<SortKey>("tot");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const mesL = lancamentos.filter((l) => l.mes_fatura === curMes && l.ano_fatura === curAno);
  const total = mesL.reduce((s, l) => s + Number(l.valor), 0);
  const catTotals = (["combustivel", "casa", "pessoal"] as const).map((k) => ({
    k, valor: mesL.filter((l) => l.categoria === k).reduce((s, l) => s + Number(l.valor), 0),
  }));

  // Consolidated totals
  const limiteTotalGeral = cartoes.reduce((s, c) => s + Number(c.limite_total), 0);
  const limiteDisponivel = Math.max(0, limiteTotalGeral - total);

  // Filter cartoes
  const cartoesFiltrados = cartoes.filter((c) => {
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (bandeira !== "todas" && c.bandeira !== bandeira) return false;
    if (statusF !== "todos" && c.status !== statusF) return false;
    if (catF !== "todas") {
      const has = mesL.some((l) => l.cartao_id === c.id && l.categoria === catF);
      if (!has) return false;
    }
    return true;
  });

  // Alertas
  const today = new Date();
  let acima80 = 0, vencendo5 = 0, atrasadas = 0, totalVencer = 0;
  cartoes.forEach((c) => {
    const usado = mesL.filter((l) => l.cartao_id === c.id).reduce((s, l) => s + Number(l.valor), 0);
    const pct = c.limite_total > 0 ? (usado / Number(c.limite_total)) * 100 : 0;
    if (pct >= 80) acima80++;
    const fat = faturas.find((f) => f.cartao_id === c.id && f.mes === curMes && f.ano === curAno);
    const venc = vencimentoDate(curAno, curMes, c.dia_vencimento);
    const dias = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const paga = fat?.status === "paga";
    if (!paga && usado > 0) {
      totalVencer += usado;
      if (dias >= 0 && dias <= 5) vencendo5++;
      if (dias < 0) atrasadas++;
    }
  });

  const tableData = cartoesFiltrados.map((c) => {
    const cl = mesL.filter((l) => l.cartao_id === c.id);
    const comb = cl.filter((l) => l.categoria === "combustivel").reduce((s, l) => s + Number(l.valor), 0);
    const casa = cl.filter((l) => l.categoria === "casa").reduce((s, l) => s + Number(l.valor), 0);
    const pess = cl.filter((l) => l.categoria === "pessoal").reduce((s, l) => s + Number(l.valor), 0);
    const tot = comb + casa + pess;
    return { c, comb, casa, pess, tot, limite: Number(c.limite_total), pct: c.limite_total > 0 ? (tot / Number(c.limite_total)) * 100 : 0, venc: c.dia_vencimento };
  });

  const sorted = [...tableData].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "nome") return a.c.nome.localeCompare(b.c.nome) * dir;
    const av = (a as any)[sortBy] ?? 0, bv = (b as any)[sortBy] ?? 0;
    return (av - bv) * dir;
  });

  const totRow = sorted.reduce((acc, r) => ({
    comb: acc.comb + r.comb, casa: acc.casa + r.casa, pess: acc.pess + r.pess, tot: acc.tot + r.tot, limite: acc.limite + r.limite,
  }), { comb: 0, casa: 0, pess: 0, tot: 0, limite: 0 });

  const chartData = sorted.map(({ c, comb, casa, pess }) => ({ name: c.nome, Combustível: comb, Casa: casa, Pessoal: pess }));

  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(k); setSortDir("desc"); }
  };
  const SortHead = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none ${className}`} onClick={() => toggleSort(k)}>
      {children}{sortBy === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Alertas consolidados */}
      {(acima80 > 0 || vencendo5 > 0 || atrasadas > 0 || totalVencer > 0) && (
        <Card className="shadow-soft border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /><div><div className="font-medium">{acima80}</div><div className="text-xs text-muted-foreground">Acima de 80% limite</div></div></div>
            <div className="flex items-center gap-2"><Clock className="size-4 text-amber-600" /><div><div className="font-medium">{vencendo5}</div><div className="text-xs text-muted-foreground">Vencem em ≤5 dias</div></div></div>
            <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /><div><div className="font-medium">{atrasadas}</div><div className="text-xs text-muted-foreground">Faturas em atraso</div></div></div>
            <div className="flex items-center gap-2"><CCIcon className="size-4 text-primary" /><div><div className="font-medium">{brl(totalVencer)}</div><div className="text-xs text-muted-foreground">Total a vencer no mês</div></div></div>
          </CardContent>
        </Card>
      )}

      {/* Total geral por categoria */}
      <div className="grid md:grid-cols-3 gap-4">
        {catTotals.map(({ k, valor }) => <CatCard key={k} k={k} valor={valor} pct={total ? (valor / total) * 100 : 0} />)}
      </div>

      {/* Consolidado geral */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Total gasto (mês)</div><div className="text-2xl font-display mt-1">{brl(total)}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Limite disponível consolidado</div><div className="text-2xl font-display mt-1 text-success">{brl(limiteDisponivel)}</div><div className="text-xs text-muted-foreground">de {brl(limiteTotalGeral)}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Faturas a vencer no mês</div><div className="text-2xl font-display mt-1 text-destructive">{brl(totalVencer)}</div></CardContent></Card>
      </div>

      {/* Filtros */}
      <Card className="shadow-soft"><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Buscar cartão</Label><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome..." /></div>
        <div><Label className="text-xs">Bandeira</Label>
          <Select value={bandeira} onValueChange={setBandeira}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem>{BANDEIRAS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Categoria</Label>
          <Select value={catF} onValueChange={setCatF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="combustivel">🚗 Combustível</SelectItem><SelectItem value="casa">🏠 Casa</SelectItem><SelectItem value="pessoal">👤 Pessoal</SelectItem></SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      {/* Tabela comparativa */}
      <Card className="shadow-soft"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <SortHead k="nome" className="sticky left-0 bg-background z-10 min-w-[180px]">Cartão</SortHead>
              <SortHead k="comb" className="text-right">🚗 Combustível</SortHead>
              <SortHead k="casa" className="text-right">🏠 Casa</SortHead>
              <SortHead k="pess" className="text-right">👤 Pessoal</SortHead>
              <SortHead k="tot" className="text-right">Total</SortHead>
              <SortHead k="limite" className="text-right">Limite</SortHead>
              <SortHead k="pct" className="text-right">% Usado</SortHead>
              <SortHead k="venc" className="text-right">Venc.</SortHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sem cartões.</TableCell></TableRow>}
              {sorted.map(({ c, comb, casa, pess, tot, limite, pct, venc }) => (
                <TableRow key={c.id}>
                  <TableCell className="sticky left-0 bg-background z-10"><span className="inline-block size-3 rounded-full mr-2 align-middle" style={{ background: c.cor }} />{c.nome}</TableCell>
                  <TableCell className="text-right">{brl(comb)}</TableCell>
                  <TableCell className="text-right">{brl(casa)}</TableCell>
                  <TableCell className="text-right">{brl(pess)}</TableCell>
                  <TableCell className="text-right font-medium">{brl(tot)}</TableCell>
                  <TableCell className="text-right">{brl(limite)}</TableCell>
                  <TableCell className={`text-right ${pct >= 80 ? "text-destructive font-medium" : ""}`}>{pct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right">dia {venc}</TableCell>
                </TableRow>
              ))}
              {sorted.length > 0 && (
                <TableRow className="font-medium bg-muted/40">
                  <TableCell className="sticky left-0 bg-muted/40 z-10">TOTAL</TableCell>
                  <TableCell className="text-right">{brl(totRow.comb)}</TableCell>
                  <TableCell className="text-right">{brl(totRow.casa)}</TableCell>
                  <TableCell className="text-right">{brl(totRow.pess)}</TableCell>
                  <TableCell className="text-right">{brl(totRow.tot)}</TableCell>
                  <TableCell className="text-right">{brl(totRow.limite)}</TableCell>
                  <TableCell className="text-right">{totRow.limite > 0 ? ((totRow.tot / totRow.limite) * 100).toFixed(0) : 0}%</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>

      <Card className="shadow-soft"><CardContent className="p-5">
        <div className="font-display text-lg mb-4">Gastos por cartão e categoria</div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => brl(Number(v))} />
              <Legend />
              <Bar dataKey="Combustível" stackId="a" fill={CAT_META.combustivel.color} />
              <Bar dataKey="Casa" stackId="a" fill={CAT_META.casa.color} />
              <Bar dataKey="Pessoal" stackId="a" fill={CAT_META.pessoal.color} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent></Card>
    </div>
  );
}

function HistoricoMensal({ cartoes, lancamentos }: { cartoes: Cartao[]; lancamentos: Lancamento[] }) {
  const [cartaoId, setCartaoId] = useState("todos");

  const filtered = cartaoId === "todos" ? lancamentos : lancamentos.filter((l) => l.cartao_id === cartaoId);
  const map: Record<string, { mes: string; Combustível: number; Casa: number; Pessoal: number }> = {};
  for (const l of filtered) {
    const k = `${l.ano_fatura}-${String(l.mes_fatura).padStart(2, "0")}`;
    map[k] ??= { mes: k, Combustível: 0, Casa: 0, Pessoal: 0 };
    const catKey = l.categoria === "combustivel" ? "Combustível" : l.categoria === "casa" ? "Casa" : "Pessoal";
    map[k][catKey] += Number(l.valor);
  }
  const data = Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));

  return (
    <Card className="shadow-soft"><CardContent className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display text-lg">Evolução mensal por categoria</div>
        <Select value={cartaoId} onValueChange={setCartaoId}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os cartões</SelectItem>
            {cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="h-72">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => brl(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="Combustível" stroke={CAT_META.combustivel.color} strokeWidth={2} />
            <Line type="monotone" dataKey="Casa" stroke={CAT_META.casa.color} strokeWidth={2} />
            <Line type="monotone" dataKey="Pessoal" stroke={CAT_META.pessoal.color} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardContent></Card>
  );
}
