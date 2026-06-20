import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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

// Retorna o fechamento e o vencimento da FATURA CORRENTE
// (a próxima fatura a vencer a partir de hoje). O fechamento pode estar no passado
// (fatura já fechada, aguardando pagamento) ou no futuro (fatura ainda aberta).
function proximoCiclo(diaFechamento: number, diaVencimento: number, ref: Date = new Date()) {
  const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const lastDay = (a: number, m: number) => new Date(a, m + 1, 0).getDate();
  const mkDate = (a: number, m: number, d: number) => new Date(a, m, Math.min(d, lastDay(a, m)));

  // Próximo vencimento >= hoje
  let vAno = hoje.getFullYear();
  let vMes = hoje.getMonth();
  let venc = mkDate(vAno, vMes, diaVencimento);
  if (venc.getTime() < hoje.getTime()) {
    vMes += 1;
    if (vMes > 11) { vMes = 0; vAno += 1; }
    venc = mkDate(vAno, vMes, diaVencimento);
  }

  // Fechamento desse ciclo: mês anterior se dV < dF, mesmo mês caso contrário
  let fAno = vAno;
  let fMes = vMes;
  if (diaVencimento < diaFechamento) {
    fMes -= 1;
    if (fMes < 0) { fMes = 11; fAno -= 1; }
  }
  const fechamento = mkDate(fAno, fMes, diaFechamento);
  return { fechamento, vencimento: venc };
}


function dateBRShort(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Limite usado = soma de TODAS as parcelas cujas faturas ainda não foram pagas.
// Ao quitar uma fatura, as parcelas daquele mês são liberadas do limite.
function calcUsado(cartaoId: string, lancs: Lancamento[], faturas: Fatura[]) {
  const pagas = new Set(
    faturas
      .filter((f) => f.cartao_id === cartaoId && f.status === "paga")
      .map((f) => `${f.ano}-${f.mes}`),
  );
  return lancs
    .filter((l) => l.cartao_id === cartaoId && !pagas.has(`${l.ano_fatura}-${l.mes_fatura}`))
    .reduce((s, l) => s + Number(l.valor), 0);
}

function limiteStatus(limite: number, usado: number) {
  const disp = Number(limite) - usado;
  const pct = limite > 0 ? (usado / limite) * 100 : 0;
  if (disp < 0) return { disp, pct, level: "estourado" as const };
  if (pct >= 80) return { disp, pct, level: "critico" as const };
  return { disp, pct, level: "ok" as const };
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
      const { data, error } = await (supabase.from("cartoes_lancamentos" as any).select("*").is("deleted_at", null).order("data", { ascending: false }));
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
          <LancDialog cartoes={cartoes} lancamentos={lancamentos} faturas={faturas} userId={user?.id ?? ""} onDone={() => { setOpenLanc(false); invalidate(); }} />
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
              <CartaoCard key={c.id} cartao={c} contas={contas} lancamentos={lancByCartao[c.id] ?? []} faturas={faturas.filter((f) => f.cartao_id === c.id)} curMes={curMes} curAno={curAno} onClick={() => setTab(c.id)} onVerHistorico={() => setTab("historico")} onPaga={invalidate} onChanged={invalidate} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoMensal cartoes={cartoes} lancamentos={lancamentos} />
        </TabsContent>

        {cartoes.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-4">
            <CartaoDetalhe cartao={c} lancamentos={lancByCartao[c.id] ?? []} faturas={faturas.filter((f) => f.cartao_id === c.id)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CartaoCard({ cartao, contas, lancamentos, faturas, curMes, curAno, onClick, onVerHistorico, onPaga, onChanged }: {
  cartao: Cartao; contas: { id: string; name: string }[]; lancamentos: Lancamento[]; faturas: Fatura[]; curMes: number; curAno: number;
  onClick: () => void; onVerHistorico?: () => void; onPaga: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  // Limite usado = todas parcelas pendentes (fatura não paga)
  const usado = calcUsado(cartao.id, lancamentos, faturas);
  const { disp, pct, level } = limiteStatus(Number(cartao.limite_total), usado);
  const pctVisual = Math.min(100, pct);

  const { fechamento: proxFech, vencimento: proxVenc } = proximoCiclo(cartao.dia_fechamento, cartao.dia_vencimento);
  const mesV = proxVenc.getMonth() + 1;
  const anoV = proxVenc.getFullYear();
  const hojeD = new Date();
  const hojeMid = new Date(hojeD.getFullYear(), hojeD.getMonth(), hojeD.getDate());
  const diasVenc = Math.ceil((proxVenc.getTime() - hojeMid.getTime()) / (1000 * 60 * 60 * 24));

  // Fatura corrente baseada no vencimento próximo (não no mês calendário)
  const fat = faturas.find((f) => f.mes === mesV && f.ano === anoV);

  // Lançamentos pendentes = não estão em nenhuma fatura paga
  const faturasPagasKeys = new Set(
    faturas.filter((f) => f.status === "paga").map((f) => `${f.ano}-${f.mes}`),
  );
  const ativos = lancamentos.filter((l) => (l as any).status !== "cancelado");
  const pendentes = ativos.filter(
    (l) => !faturasPagasKeys.has(`${l.ano_fatura}-${l.mes_fatura}`),
  );
  const totalFatura = pendentes.reduce((s, l) => s + Number(l.valor), 0);

  // Categorias: TODOS os lançamentos ativos do cartão (sem filtro de mês)
  const catTotals = CAT_KEYS.map((k) => ({
    k,
    total: ativos.filter((l) => l.categoria === k).reduce((s, l) => s + Number(l.valor), 0),
  }));

  // Status: ABERTA até o fechamento; FECHADA entre fechamento e vencimento; VENCIDA após vencimento.
  const hojeMs = hojeMid.getTime();
  const status: "aberta" | "fechada" | "paga" | "atrasada" =
    fat?.status === "paga" ? "paga"
    : hojeMs > proxVenc.getTime() ? "atrasada"
    : hojeMs > proxFech.getTime() ? "fechada"
    : "aberta";


  const estornarPaga = useMutation({
    mutationFn: async () => {
      if (!fat) throw new Error("Fatura não encontrada");
      const desc = `Fatura ${cartao.nome} — ${String(fat.mes).padStart(2, "0")}/${fat.ano}`;
      await supabase.from("bank_movements").delete().eq("origin", "cartao_fatura").eq("reference_id", fat.id);
      await supabase.from("payables").delete().eq("description", desc).eq("category", "Cartão de Crédito").eq("status", "pago");
      const { error } = await (supabase.from("cartoes_faturas" as any).update({ status: "fechada", data_pagamento: null }).eq("id", fat.id));
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pagamento estornado com sucesso!"); qc.invalidateQueries({ queryKey: ["cartoes_faturas"] }); qc.invalidateQueries({ queryKey: ["bank_movements"] }); qc.invalidateQueries({ queryKey: ["payables"] }); onPaga(); },
    onError: (e: any) => toast.error(e.message),
  });

  const onEstornar = async () => {
    const ok = await confirm({
      title: "Estornar pagamento",
      description: `Deseja estornar o pagamento da fatura do ${cartao.nome} de ${fat?.data_pagamento ? dateBR(fat.data_pagamento) : ""}?\n\nIsso irá:\n• Voltar status da fatura para 'Fechada'\n• Estornar a saída na conta bancária vinculada\n• O valor voltará ao saldo da conta`,
      confirmText: "Confirmar estorno",
    });
    if (ok) estornarPaga.mutate();
  };

  const alertaVenc = diasVenc >= 0 && diasVenc <= 5 && status !== "paga";
  const alertaAtraso = status === "atrasada";

  const cardBg =
    level === "estourado" ? "bg-destructive/5 border-destructive/40"
    : level === "critico" ? "bg-amber-50 border-amber-300"
    : "";
  const progressClass =
    level === "estourado" ? "[&>div]:bg-destructive"
    : level === "critico" ? "[&>div]:bg-amber-500"
    : "[&>div]:bg-success";

  return (
    <Card className={`shadow-soft overflow-hidden ${cardBg}`}>
      <div className="p-5 text-white cursor-pointer" style={{ background: `linear-gradient(135deg, ${cartao.cor}, ${cartao.cor}dd)` }} onClick={onClick}>
        <div className="flex items-center justify-between">
          <CCIcon className="size-6" />
          <span className="text-xs font-medium uppercase">{cartao.bandeira}</span>
        </div>
        <div className="font-display text-xl mt-6">{cartao.nome}</div>
        <div className="text-xs opacity-80 mt-1">Fecha: {dateBRShort(proxFech)} · Vence: {dateBRShort(proxVenc)}</div>
      </div>
      <CardContent className="p-5 space-y-3">
        {level === "estourado" && (
          <div className="rounded-md bg-destructive text-destructive-foreground text-xs font-medium px-2 py-1 text-center">
            ⛔ LIMITE ESTOURADO — Acima em {brl(Math.abs(disp))}
          </div>
        )}
        {level === "critico" && (
          <div className="rounded-md bg-amber-500 text-white text-xs font-medium px-2 py-1 text-center">
            ⚠️ LIMITE CRÍTICO — {pct.toFixed(0)}% utilizado
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="text-muted-foreground">Limite</div><div className="font-medium">{brl(cartao.limite_total)}</div></div>
          <div><div className="text-muted-foreground">Usado</div><div className="font-medium text-destructive">{brl(usado)}</div></div>
          <div><div className="text-muted-foreground">Disponível</div><div className={`font-medium ${disp < 0 ? "text-destructive" : "text-success"}`}>{brl(disp)}</div></div>
        </div>
        <div>
          <Progress value={pctVisual} className={`h-2 transition-all ${progressClass}`} />
          <div className={`text-xs mt-1 ${level === "estourado" ? "text-destructive font-medium" : "text-muted-foreground"}`}>{pct.toFixed(0)}% utilizado</div>
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
                : diasVenc >= 0 ? `Vence em ${diasVenc} dias — ${brl(totalFatura)}` : `Venceu há ${Math.abs(diasVenc)} dias — ${brl(totalFatura)}`}
            </div>
          </div>
          {status !== "paga" && totalFatura > 0 && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <CheckCircle2 className="size-3 mr-1" /> Pagar fatura
            </Button>
          )}
          {status === "paga" && (
            <Button size="sm" variant="outline" onClick={onEstornar} disabled={estornarPaga.isPending}>
              Estornar pagamento
            </Button>
          )}
        </div>

        {(alertaVenc || alertaAtraso) && (
          <div className="space-y-1 pt-2 border-t">
            {alertaVenc && <div className="flex items-center gap-1 text-xs text-amber-600"><Clock className="size-3" /> Vence em {diasVenc} dia(s)</div>}
            {alertaAtraso && <div className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> Fatura vencida</div>}
          </div>
        )}
        {(() => {
          const futuras = ativos.filter((l) => l.ano_fatura > anoV || (l.ano_fatura === anoV && l.mes_fatura > mesV));
          const totalFut = futuras.reduce((s, l) => s + Number(l.valor), 0);
          if (futuras.length === 0) return null;
          return (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-primary">📅 {futuras.length} lançamento{futuras.length > 1 ? "s" : ""} em meses futuros</div>
                <div className="text-muted-foreground">Total: {brl(totalFut)}</div>
              </div>
              {onVerHistorico && (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onVerHistorico(); }}>
                  Ver todos os meses
                </Button>
              )}
            </div>
          );
        })()}
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
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <PagarFaturaDialog
          cartao={cartao}
          contas={contas}
          mes={mesV}
          ano={anoV}
          vencimento={proxVenc}
          total={totalFatura}
          onDone={() => { setPayOpen(false); onPaga(); }}
        />
      </Dialog>
    </Card>
  );
}

function PagarFaturaDialog({ cartao, contas, mes, ano, vencimento, total, onDone }: {
  cartao: Cartao;
  contas: { id: string; name: string }[];
  mes: number; ano: number;
  vencimento: Date;
  total: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [dataPag, setDataPag] = useState(hojeISO);
  const [contaId, setContaId] = useState(cartao.conta_bancaria_id ?? "");
  const [valor, setValor] = useState(String(total.toFixed(2)));

  const pagar = useMutation({
    mutationFn: async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) throw new Error("Sessão inválida");
      const vNum = Number(valor);
      if (!vNum || vNum <= 0) throw new Error("Valor inválido");
      if (!contaId) throw new Error("Selecione a conta debitada");
      const desc = `Fatura ${cartao.nome} ${String(mes).padStart(2, "0")}/${ano}`;
      const { data: upserted, error } = await (supabase.from("cartoes_faturas" as any).upsert({
        cartao_id: cartao.id, user_id: uid,
        mes, ano, valor_total: total, status: "paga",
        data_pagamento: dataPag,
      }, { onConflict: "cartao_id,ano,mes" }).select().single());
      if (error) throw error;
      const faturaId = (upserted as any)?.id;
      const { error: bmErr } = await supabase.from("bank_movements").insert({
        user_id: uid, account_id: contaId, movement_date: dataPag,
        type: "saida", category: "Cartão de Crédito",
        description: `Pagamento ${desc}`, amount: vNum,
        origin: "cartao_fatura", reference_id: faturaId,
      });
      if (bmErr) throw bmErr;
      const vencISO = vencimento.toISOString().slice(0, 10);
      const { error: pErr } = await supabase.from("payables").insert({
        user_id: uid, description: desc, category: "Cartão de Crédito",
        amount: vNum, due_date: vencISO, status: "pago",
        paid_amount: vNum, paid_at: new Date(dataPag + "T12:00:00").toISOString(),
        bank_account_id: contaId, payment_method: "cartao",
      });
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      toast.success("Fatura paga com sucesso!");
      qc.invalidateQueries({ queryKey: ["cartoes_faturas"] });
      qc.invalidateQueries({ queryKey: ["bank_movements"] });
      qc.invalidateQueries({ queryKey: ["payables"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Pagar fatura — {cartao.nome}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="rounded-md border p-3 text-sm bg-muted/30">
          <div className="flex justify-between"><span className="text-muted-foreground">Total da fatura:</span><span className="font-medium">{brl(total)}</span></div>
          <div className="flex justify-between mt-1"><span className="text-muted-foreground">Vencimento:</span><span className="font-medium">{dateBRShort(vencimento)}</span></div>
        </div>
        <div><Label>Data do pagamento</Label><Input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} /></div>
        <div><Label>Conta debitada</Label>
          <Select value={contaId} onValueChange={setContaId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Valor pago</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>Cancelar</Button>
        <Button onClick={() => pagar.mutate()} disabled={pagar.isPending}>Confirmar pagamento</Button>
      </DialogFooter>
    </DialogContent>
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

function LancDialog({ cartoes, lancamentos, faturas, userId, onDone }: { cartoes: Cartao[]; lancamentos: Lancamento[]; faturas: Fatura[]; userId: string; onDone: () => void }) {
  const confirm = useConfirm();
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
  const usadoAtual = cartao ? calcUsado(cartao.id, lancamentos, faturas) : 0;
  const limiteTotal = cartao ? Number(cartao.limite_total) : 0;
  const novoUsado = usadoAtual + valorNum;
  const vaiEstourar = !!cartao && novoUsado > limiteTotal;

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
        {vaiEstourar && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1 font-medium text-destructive"><AlertTriangle className="size-3" /> Este lançamento vai estourar o limite do cartão</div>
            <div className="grid grid-cols-2 gap-x-3">
              <span className="text-muted-foreground">Limite total:</span><span className="text-right">{brl(limiteTotal)}</span>
              <span className="text-muted-foreground">Limite já usado:</span><span className="text-right">{brl(usadoAtual)}</span>
              <span className="text-muted-foreground">Este lançamento:</span><span className="text-right">{brl(valorNum)}</span>
              <span className="font-medium">Saldo após:</span><span className="text-right font-medium text-destructive">{brl(limiteTotal - novoUsado)}</span>
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={async () => {
            if (save.isPending) return;
            if (vaiEstourar) {
              const ok = await confirm({
                title: "Limite vai estourar",
                description: `Limite total: ${brl(limiteTotal)}\nLimite já usado: ${brl(usadoAtual)}\nEste lançamento: ${brl(valorNum)}\nSaldo após: ${brl(limiteTotal - novoUsado)}\n\nDeseja continuar mesmo assim?`,
                confirmText: "Confirmar mesmo assim",
                destructive: true,
              });
              if (!ok) return;
            }
            if (save.isPending) return;
            save.mutate();
          }}
          disabled={save.isPending}
        >
          {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
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

function CartaoDetalhe({ cartao, lancamentos, faturas }: { cartao: Cartao; lancamentos: Lancamento[]; faturas: Fatura[] }) {
  const today = new Date();
  const curMes = today.getMonth() + 1;
  const curAno = today.getFullYear();
  // Default to first fatura with lançamentos (current or future), else current month
  const defaultFat = useMemo(() => {
    const futuras = lancamentos
      .filter((l) => l.ano_fatura > curAno || (l.ano_fatura === curAno && l.mes_fatura >= curMes))
      .sort((a, b) => a.ano_fatura - b.ano_fatura || a.mes_fatura - b.mes_fatura);
    return futuras[0] ? { mes: futuras[0].mes_fatura, ano: futuras[0].ano_fatura } : { mes: curMes, ano: curAno };
  }, [lancamentos, curMes, curAno]);
  const [mes, setMes] = useState(String(defaultFat.mes));
  const [ano, setAno] = useState(String(defaultFat.ano));
  const touchedRef = useRef(false);
  useEffect(() => {
    if (touchedRef.current) return;
    setMes(String(defaultFat.mes));
    setAno(String(defaultFat.ano));
  }, [defaultFat.mes, defaultFat.ano]);
  const onChangeMes = (v: string) => { touchedRef.current = true; setMes(v); };
  const onChangeAno = (v: string) => { touchedRef.current = true; setAno(v); };
  const mesN = Number(mes), anoN = Number(ano);

  const filtered = lancamentos.filter((l) => l.mes_fatura === mesN && l.ano_fatura === anoN);
  const total = filtered.reduce((s, l) => s + Number(l.valor), 0);
  // Limite usado = todas parcelas com fatura ainda não paga
  const usadoTotal = calcUsado(cartao.id, lancamentos, faturas);
  const { disp, pct, level } = limiteStatus(Number(cartao.limite_total), usadoTotal);
  const catTotals = CAT_KEYS.map((k) => ({
    k, valor: filtered.filter((l) => l.categoria === k).reduce((s, l) => s + Number(l.valor), 0),
  }));
  const pieData = catTotals.map(({ k, valor }) => ({ name: CAT_META[k].label, value: valor, color: CAT_META[k].color }));

  // Próximas faturas — agrupa lançamentos pendentes por (ano,mes), apenas futuras (incluindo o mês atual)
  const pagasSet = new Set(faturas.filter((f) => f.status === "paga").map((f) => `${f.ano}-${f.mes}`));
  const proximasMap: Record<string, { ano: number; mes: number; valor: number; parcelas: number }> = {};
  for (const l of lancamentos) {
    const k = `${l.ano_fatura}-${l.mes_fatura}`;
    if (pagasSet.has(k)) continue;
    if (l.ano_fatura < curAno || (l.ano_fatura === curAno && l.mes_fatura < curMes)) continue;
    proximasMap[k] ??= { ano: l.ano_fatura, mes: l.mes_fatura, valor: 0, parcelas: 0 };
    proximasMap[k].valor += Number(l.valor);
    proximasMap[k].parcelas += 1;
  }
  const proximas = Object.values(proximasMap).sort((a, b) => a.ano - b.ano || a.mes - b.mes);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div><Label className="text-xs">Mês</Label>
          <Select value={mes} onValueChange={onChangeMes}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Ano</Label>
          <Select value={ano} onValueChange={onChangeAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {catTotals.map(({ k, valor }) => <CatCard key={k} k={k} valor={valor} pct={total ? (valor / total) * 100 : 0} />)}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-soft md:col-span-1"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Total gasto no mês</div>
          <div className="text-2xl font-display mt-1">{brl(total)}</div>
          <div className="text-xs text-muted-foreground mt-3">Limite usado (todas parcelas)</div>
          <div className="text-base font-medium text-destructive">{brl(usadoTotal)}</div>
          <div className="text-xs text-muted-foreground mt-2">Limite disponível</div>
          <div className={`text-lg font-medium ${disp < 0 ? "text-destructive" : "text-success"}`}>{brl(disp)}</div>
          <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}% utilizado {level === "estourado" && "⛔"}{level === "critico" && "⚠️"}</div>
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
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Parcela</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem lançamentos no período.</TableCell></TableRow>}
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{dateBR(l.data)}</TableCell>
                <TableCell>{l.descricao}</TableCell>
                <TableCell>{CAT_META[l.categoria].emoji} {CAT_META[l.categoria].label}</TableCell>
                <TableCell>{l.parcelado ? `${l.parcela_atual}/${l.total_parcelas}` : "—"}</TableCell>
                <TableCell className="text-right font-medium">{brl(Number(l.valor))}</TableCell>
                <TableCell className="text-right"><LancActions lanc={l} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card className="shadow-soft"><CardContent className="p-5">
        <div className="font-display text-lg mb-3">Próximas faturas</div>
        <Table>
          <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Valor da fatura</TableHead><TableHead className="text-right">Parcelas previstas</TableHead></TableRow></TableHeader>
          <TableBody>
            {proximas.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Sem faturas pendentes.</TableCell></TableRow>}
            {proximas.map((p) => (
              <TableRow key={`${p.ano}-${p.mes}`}>
                <TableCell>{String(p.mes).padStart(2, "0")}/{p.ano}</TableCell>
                <TableCell className="text-right font-medium">{brl(p.valor)}</TableCell>
                <TableCell className="text-right">{p.parcelas}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <HistoricoFaturas cartao={cartao} faturas={faturas} />
    </div>
  );
}

function HistoricoFaturas({ cartao, faturas }: { cartao: Cartao; faturas: Fatura[] }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const pagas = faturas
    .filter((f) => f.status === "paga")
    .sort((a, b) => b.ano - a.ano || b.mes - a.mes);
  const estornar = useMutation({
    mutationFn: async (fat: Fatura) => {
      const desc = `Fatura ${cartao.nome} — ${String(fat.mes).padStart(2, "0")}/${fat.ano}`;
      await supabase.from("bank_movements").delete().eq("origin", "cartao_fatura").eq("reference_id", fat.id);
      await supabase.from("payables").delete().eq("description", desc).eq("category", "Cartão de Crédito").eq("status", "pago");
      const { error } = await (supabase.from("cartoes_faturas" as any).update({ status: "fechada", data_pagamento: null }).eq("id", fat.id));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento estornado com sucesso!");
      qc.invalidateQueries({ queryKey: ["cartoes_faturas"] });
      qc.invalidateQueries({ queryKey: ["bank_movements"] });
      qc.invalidateQueries({ queryKey: ["payables"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const onEstornar = async (fat: Fatura) => {
    const ok = await confirm({
      title: "Estornar pagamento",
      description: `Deseja estornar o pagamento da fatura do ${cartao.nome} de ${fat.data_pagamento ? dateBR(fat.data_pagamento) : ""}?\n\nIsso irá voltar status para 'Fechada' e estornar a saída na conta bancária.`,
      confirmText: "Confirmar estorno",
    });
    if (ok) estornar.mutate(fat);
  };
  return (
    <Card className="shadow-soft"><CardContent className="p-5">
      <div className="font-display text-lg mb-3">Histórico de faturas</div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Mês</TableHead>
          <TableHead className="text-right">Total fatura</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Pago em</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {pagas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma fatura paga.</TableCell></TableRow>}
          {pagas.map((f) => (
            <TableRow key={f.id}>
              <TableCell>{String(f.mes).padStart(2, "0")}/{f.ano}</TableCell>
              <TableCell className="text-right font-medium">{brl(Number(f.valor_total))}</TableCell>
              <TableCell>{dateBR(vencimentoDate(f.ano, f.mes, cartao.dia_vencimento).toISOString().slice(0, 10))}</TableCell>
              <TableCell><Badge className="bg-success">Paga ✅</Badge></TableCell>
              <TableCell>{f.data_pagamento ? dateBR(f.data_pagamento) : "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onEstornar(f)} disabled={estornar.isPending}>Estornar</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

type SortKey = "nome" | "comb" | "casa" | "pess" | "forn" | "tot" | "limite" | "pct" | "venc";
type PeriodPreset = "este_mes" | "mes_anterior" | "ultimos_3" | "ultimos_6" | "ano_atual" | "todos" | "personalizado";

function getPeriodRange(preset: PeriodPreset, customStart: string, customEnd: string): { start: string; end: string; label: string } {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let start: Date, end: Date, label: string;
  switch (preset) {
    case "mes_anterior": start = new Date(y, m - 1, 1); end = new Date(y, m, 0); label = "Mês anterior"; break;
    case "ultimos_3": start = new Date(y, m - 2, 1); end = new Date(y, m + 1, 0); label = "Últimos 3 meses"; break;
    case "ultimos_6": start = new Date(y, m - 5, 1); end = new Date(y, m + 1, 0); label = "Últimos 6 meses"; break;
    case "ano_atual": start = new Date(y, 0, 1); end = new Date(y, 11, 31); label = "Ano atual"; break;
    case "todos": start = new Date(2000, 0, 1); end = new Date(2099, 11, 31); label = "Todos os lançamentos"; break;
    case "personalizado":
      start = customStart ? new Date(customStart + "T00:00:00") : new Date(y, m, 1);
      end = customEnd ? new Date(customEnd + "T00:00:00") : new Date(y, m + 1, 0);
      label = "Personalizado"; break;
    default: start = new Date(y, m, 1); end = new Date(y, m + 1, 0); label = "Este mês";
  }
  return { start: toISO(start), end: toISO(end), label };
}

function PeriodoFiltro({ preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd }: {
  preset: PeriodPreset; setPreset: (p: PeriodPreset) => void;
  customStart: string; setCustomStart: (v: string) => void;
  customEnd: string; setCustomEnd: (v: string) => void;
}) {
  const opts: { v: PeriodPreset; label: string }[] = [
    { v: "este_mes", label: "Este mês" },
    { v: "mes_anterior", label: "Mês anterior" },
    { v: "ultimos_3", label: "Últimos 3 meses" },
    { v: "ultimos_6", label: "Últimos 6 meses" },
    { v: "ano_atual", label: "Ano atual" },
    { v: "todos", label: "📋 Todos os lançamentos" },
    { v: "personalizado", label: "Personalizado" },
  ];
  return (
    <Card className="shadow-soft"><CardContent className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <Button key={o.v} size="sm" variant={preset === o.v ? "default" : "outline"} onClick={() => setPreset(o.v)}>{o.label}</Button>
        ))}
      </div>
      {preset === "personalizado" && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div><Label className="text-xs">Data inicial</Label><Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></div>
          <div><Label className="text-xs">Data final</Label><Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></div>
        </div>
      )}
    </CardContent></Card>
  );
}

function VisaoGeral({ cartoes, lancamentos, faturas, curMes, curAno }: { cartoes: Cartao[]; lancamentos: Lancamento[]; faturas: Fatura[]; curMes: number; curAno: number }) {
  const [busca, setBusca] = useState("");
  const [bandeira, setBandeira] = useState("todas");
  const [statusF, setStatusF] = useState("todos");
  const [catF, setCatF] = useState("todas");
  const [sortBy, setSortBy] = useState<SortKey>("tot");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [preset, setPreset] = useState<PeriodPreset>("este_mes");
  const today0 = new Date();
  const defStart = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, "0")}-01`;
  const defEnd = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, "0")}-${String(new Date(today0.getFullYear(), today0.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  const [customStart, setCustomStart] = useState(defStart);
  const [customEnd, setCustomEnd] = useState(defEnd);
  const { start, end, label: periodoLabel } = getPeriodRange(preset, customStart, customEnd);

  // Lançamentos do período (pela data da compra/parcela)
  const mesL = useMemo(() => lancamentos.filter((l) => l.data >= start && l.data <= end), [lancamentos, start, end]);
  const total = useMemo(() => mesL.reduce((s, l) => s + Number(l.valor), 0), [mesL]);
  const catTotals = useMemo(() => CAT_KEYS.map((k) => ({
    k, valor: mesL.filter((l) => l.categoria === k).reduce((s, l) => s + Number(l.valor), 0),
  })), [mesL]);

  // Consolidated totals — limite usado SEMPRE = todas parcelas pendentes (ignora filtro de período)
  // Pré-calcula uma vez o "usado real" por cartão para evitar O(C×L) em múltiplos pontos da tela
  const usadoPorCartao = useMemo(() => {
    const pagasKey = new Set(faturas.filter((f) => f.status === "paga").map((f) => `${f.cartao_id}-${f.ano}-${f.mes}`));
    const map: Record<string, number> = {};
    for (const c of cartoes) map[c.id] = 0;
    for (const l of lancamentos) {
      if (!pagasKey.has(`${l.cartao_id}-${l.ano_fatura}-${l.mes_fatura}`)) {
        map[l.cartao_id] = (map[l.cartao_id] ?? 0) + Number(l.valor);
      }
    }
    return map;
  }, [cartoes, lancamentos, faturas]);
  const limiteTotalGeral = useMemo(() => cartoes.reduce((s, c) => s + Number(c.limite_total), 0), [cartoes]);
  const usadoTotalReal = useMemo(() => Object.values(usadoPorCartao).reduce((s, v) => s + v, 0), [usadoPorCartao]);
  const limiteDisponivel = limiteTotalGeral - usadoTotalReal;

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

  // Alertas (sempre baseados no mês corrente p/ não distorcer)
  const today = new Date();
  const mesAtualL = lancamentos.filter((l) => l.mes_fatura === curMes && l.ano_fatura === curAno);
  let acima80 = 0, vencendo5 = 0, atrasadas = 0, totalVencer = 0;
  cartoes.forEach((c) => {
    const usado = mesAtualL.filter((l) => l.cartao_id === c.id).reduce((s, l) => s + Number(l.valor), 0);
    const pct = c.limite_total > 0 ? (usado / Number(c.limite_total)) * 100 : 0;
    if (pct >= 80) acima80++;
    const fat = faturas.find((f) => f.cartao_id === c.id && f.mes === curMes && f.ano === curAno);
    const { vencimento: venc } = proximoCiclo(c.dia_fechamento, c.dia_vencimento, today);
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
    const forn = cl.filter((l) => l.categoria === "fornecedores").reduce((s, l) => s + Number(l.valor), 0);
    const tot = comb + casa + pess + forn;
    return { c, comb, casa, pess, forn, tot, limite: Number(c.limite_total), pct: c.limite_total > 0 ? (tot / Number(c.limite_total)) * 100 : 0, venc: c.dia_vencimento };
  });

  const sorted = [...tableData].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "nome") return a.c.nome.localeCompare(b.c.nome) * dir;
    const av = (a as any)[sortBy] ?? 0, bv = (b as any)[sortBy] ?? 0;
    return (av - bv) * dir;
  });

  const totRow = sorted.reduce((acc, r) => ({
    comb: acc.comb + r.comb, casa: acc.casa + r.casa, pess: acc.pess + r.pess, forn: acc.forn + r.forn, tot: acc.tot + r.tot, limite: acc.limite + r.limite,
  }), { comb: 0, casa: 0, pess: 0, forn: 0, tot: 0, limite: 0 });

  const chartData = sorted.map(({ c, comb, casa, pess, forn }) => ({ name: c.nome, Combustível: comb, Casa: casa, Pessoal: pess, Fornecedores: forn }));

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
      {/* Filtro de período */}
      <PeriodoFiltro
        preset={preset} setPreset={setPreset}
        customStart={customStart} setCustomStart={setCustomStart}
        customEnd={customEnd} setCustomEnd={setCustomEnd}
      />
      <div className="text-xs text-muted-foreground">
        Período: <strong>{periodoLabel}</strong> · {dateBR(start)} → {dateBR(end)}
      </div>

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

      {/* Total geral por categoria — todos cartões no período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {catTotals.map(({ k, valor }) => <CatCard key={k} k={k} valor={valor} pct={total ? (valor / total) * 100 : 0} />)}
      </div>

      {/* Consolidado geral */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Total gasto (período)</div><div className="text-2xl font-display mt-1">{brl(total)}</div></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Limite disponível consolidado</div><div className={`text-2xl font-display mt-1 ${limiteDisponivel < 0 ? "text-destructive" : "text-success"}`}>{brl(limiteDisponivel)}</div><div className="text-xs text-muted-foreground">de {brl(limiteTotalGeral)}</div></CardContent></Card>
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
            <SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="combustivel">🚗 Combustível</SelectItem><SelectItem value="casa">🏠 Casa</SelectItem><SelectItem value="pessoal">👤 Pessoal</SelectItem><SelectItem value="fornecedores">🏭 Fornecedores</SelectItem></SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      {/* Resumo de limites — SEMPRE total real (todas parcelas pendentes, ignora filtro de período) */}
      <Card className="shadow-soft"><CardContent className="p-5">
        <div className="font-display text-lg mb-3">Resumo de limites <span className="text-xs font-normal text-muted-foreground">(todas parcelas pendentes)</span></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cartão</TableHead>
              <TableHead className="text-right">Limite</TableHead>
              <TableHead className="text-right">Usado</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-right">% Usado</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(() => {
                const rows = cartoes.map((c) => {
                  const u = usadoPorCartao[c.id] ?? 0;
                  const st = limiteStatus(Number(c.limite_total), u);
                  return { c, usado: u, ...st };
                });
                const tot = rows.reduce((a, r) => ({ limite: a.limite + Number(r.c.limite_total), usado: a.usado + r.usado }), { limite: 0, usado: 0 });
                return (
                  <>
                    {rows.map(({ c, usado: u, disp, pct, level }) => (
                      <TableRow key={c.id} className={level === "estourado" ? "bg-destructive/5" : level === "critico" ? "bg-amber-50" : ""}>
                        <TableCell><span className="inline-block size-3 rounded-full mr-2 align-middle" style={{ background: c.cor }} />{c.nome}</TableCell>
                        <TableCell className="text-right">{brl(Number(c.limite_total))}</TableCell>
                        <TableCell className="text-right">{brl(u)}</TableCell>
                        <TableCell className={`text-right font-medium ${disp < 0 ? "text-destructive" : "text-success"}`}>{brl(disp)}</TableCell>
                        <TableCell className={`text-right ${level === "estourado" ? "text-destructive font-medium" : level === "critico" ? "text-amber-600 font-medium" : ""}`}>{pct.toFixed(0)}%</TableCell>
                        <TableCell className="text-center">{level === "estourado" ? "⛔" : level === "critico" ? "⚠️" : "✅"}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length > 0 && (
                      <TableRow className="font-medium bg-muted/40">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{brl(tot.limite)}</TableCell>
                        <TableCell className="text-right">{brl(tot.usado)}</TableCell>
                        <TableCell className={`text-right ${tot.limite - tot.usado < 0 ? "text-destructive" : "text-success"}`}>{brl(tot.limite - tot.usado)}</TableCell>
                        <TableCell className="text-right">{tot.limite > 0 ? ((tot.usado / tot.limite) * 100).toFixed(0) : 0}%</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </>
                );
              })()}
            </TableBody>
          </Table>
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
              <SortHead k="forn" className="text-right">🏭 Fornecedores</SortHead>
              <SortHead k="tot" className="text-right">Total</SortHead>
              <SortHead k="limite" className="text-right">Limite</SortHead>
              <SortHead k="pct" className="text-right">% Usado</SortHead>
              <SortHead k="venc" className="text-right">Venc.</SortHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sem cartões.</TableCell></TableRow>}
              {sorted.map(({ c, comb, casa, pess, forn, tot, limite, pct, venc }) => (
                <TableRow key={c.id}>
                  <TableCell className="sticky left-0 bg-background z-10"><span className="inline-block size-3 rounded-full mr-2 align-middle" style={{ background: c.cor }} />{c.nome}</TableCell>
                  <TableCell className="text-right">{brl(comb)}</TableCell>
                  <TableCell className="text-right">{brl(casa)}</TableCell>
                  <TableCell className="text-right">{brl(pess)}</TableCell>
                  <TableCell className="text-right">{brl(forn)}</TableCell>
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
                  <TableCell className="text-right">{brl(totRow.forn)}</TableCell>
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
              <Bar dataKey="Fornecedores" stackId="a" fill={CAT_META.fornecedores.color} />
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
  const map: Record<string, { mes: string; Combustível: number; Casa: number; Pessoal: number; Fornecedores: number }> = {};
  for (const l of filtered) {
    const k = `${l.ano_fatura}-${String(l.mes_fatura).padStart(2, "0")}`;
    map[k] ??= { mes: k, Combustível: 0, Casa: 0, Pessoal: 0, Fornecedores: 0 };
    const catKey = l.categoria === "combustivel" ? "Combustível" : l.categoria === "casa" ? "Casa" : l.categoria === "fornecedores" ? "Fornecedores" : "Pessoal";
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
            <Line type="monotone" dataKey="Fornecedores" stroke={CAT_META.fornecedores.color} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardContent></Card>
  );
}

type Scope = "apenas" | "este_e_proximos" | "todos";

function LancActions({ lanc }: { lanc: Lancamento }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);

  const isSerie = lanc.parcelado && !!lanc.grupo_parcela;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cartoes_lancamentos"] });
    qc.invalidateQueries({ queryKey: ["cartoes_faturas"] });
  };

  const idsForScope = async (scope: Scope): Promise<string[]> => {
    if (!isSerie || scope === "apenas") return [lanc.id];
    const { data, error } = await (supabase
      .from("cartoes_lancamentos" as any)
      .select("id,parcela_atual")
      .is("deleted_at", null)
      .eq("grupo_parcela", lanc.grupo_parcela as string));
    if (error) throw error;
    const all = (data ?? []) as unknown as { id: string; parcela_atual: number }[];
    if (scope === "todos") return all.map(r => r.id);
    return all.filter(r => r.parcela_atual >= lanc.parcela_atual).map(r => r.id);
  };

  const handleDelete = async () => {
    let scope: Scope = "apenas";
    if (isSerie) {
      const choice = window.prompt(
        "Este lançamento faz parte de uma série. Excluir:\n1 - Somente este lançamento\n2 - Este e os próximos da série\n3 - Todos da série\n\nDigite 1, 2 ou 3:",
        "1"
      );
      if (!choice) return;
      scope = choice === "2" ? "este_e_proximos" : choice === "3" ? "todos" : "apenas";
    } else {
      const ok = await confirm({
        title: "Excluir lançamento?",
        description: `${lanc.descricao} — ${brl(Number(lanc.valor))}`,
        confirmText: "Excluir",
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      const ids = await idsForScope(scope);
      const { error } = await (supabase.from("cartoes_lancamentos" as any).update({ deleted_at: new Date().toISOString() }).in("id", ids));
      if (error) throw error;
      toast.success(ids.length > 1 ? `${ids.length} lançamentos excluídos!` : "Lançamento excluído!");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <div className="inline-flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} title="Editar"><Pencil className="size-4" /></Button>
        <Button size="sm" variant="ghost" onClick={handleDelete} title="Excluir"><Trash2 className="size-4 text-destructive" /></Button>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <LancEditForm lanc={lanc} isSerie={isSerie} onDone={() => { setEditOpen(false); invalidate(); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function LancEditForm({ lanc, isSerie, onDone }: { lanc: Lancamento; isSerie: boolean; onDone: () => void }) {
  const [data, setData] = useState(lanc.data);
  const [descricao, setDescricao] = useState(
    lanc.parcelado ? lanc.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "") : lanc.descricao
  );
  const [categoria, setCategoria] = useState<CatKey>(lanc.categoria);
  const [valor, setValor] = useState<string>(String(lanc.valor));
  const [scope, setScope] = useState<Scope>("apenas");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const valorNum = Number(valor);
      if (!descricao) throw new Error("Informe a descrição");
      if (valorNum <= 0) throw new Error("Valor inválido");

      let ids: { id: string; parcela_atual: number; total_parcelas: number }[] = [
        { id: lanc.id, parcela_atual: lanc.parcela_atual, total_parcelas: lanc.total_parcelas },
      ];
      if (isSerie && scope !== "apenas") {
        const { data: rows, error } = await (supabase
          .from("cartoes_lancamentos" as any)
          .select("id,parcela_atual,total_parcelas")
          .is("deleted_at", null)
          .eq("grupo_parcela", lanc.grupo_parcela as string));
        if (error) throw error;
        const all = (rows ?? []) as unknown as any[];
        ids = scope === "todos" ? all : all.filter(r => r.parcela_atual >= lanc.parcela_atual);
      }

      for (const row of ids) {
        const payload: any = {
          descricao: lanc.parcelado ? `${descricao} (${row.parcela_atual}/${row.total_parcelas})` : descricao,
          categoria,
          valor: valorNum,
        };
        // Date changes only allowed for single edits to avoid recomputing series faturas
        if (!isSerie || scope === "apenas") {
          payload.data = data;
        }
        const { error } = await (supabase.from("cartoes_lancamentos" as any).update(payload).eq("id", row.id));
        if (error) throw error;
      }
      toast.success("Lançamento atualizado com sucesso!");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader><DialogTitle>Editar lançamento</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {isSerie && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-2">
            <div className="font-medium">Este lançamento faz parte de uma série. Editar:</div>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apenas">Somente este lançamento</SelectItem>
                <SelectItem value="este_e_proximos">Este e os próximos da série</SelectItem>
                <SelectItem value="todos">Todos da série</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={isSerie && scope !== "apenas"} />
          </div>
          <div>
            <Label>Valor</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
        </div>
        <div><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        <div>
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as CatKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="combustivel">🚗 Combustível</SelectItem>
              <SelectItem value="casa">🏠 Casa</SelectItem>
              <SelectItem value="pessoal">👤 Pessoal</SelectItem>
              <SelectItem value="fornecedores">🏭 Fornecedores</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
      </DialogFooter>
    </>
  );
}
