import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { getMatrizAccess, getMatrizPanel } from "@/lib/matriz.functions";

export const Route = createFileRoute("/_authenticated/administracao-matriz")({
  head: () => ({ meta: [{ title: "Administração da Matriz — VEJAMAIS" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: MatrizPanel,
});

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}
const STATUS: Record<string, string> = { active: "Ativa", trialing: "Em teste", past_due: "Pagamento pendente", canceled: "Cancelada", restricted: "Restrita", grace_read_only: "Carência: somente leitura", incomplete: "Incompleta", unpaid: "Não paga" };

function MatrizPanel() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const accessFn = useServerFn(getMatrizAccess);
  const panelFn = useServerFn(getMatrizPanel);
  const access = useQuery({ queryKey: ["matriz-access", user?.id], queryFn: () => accessFn(), enabled: !!user, retry: false });
  const panel = useQuery({ queryKey: ["matriz-panel", user?.id, page], queryFn: () => panelFn({ data: { page } }), enabled: !!user && access.data?.allowed === true, retry: false, gcTime: 0 });
  const data = panel.data;
  return <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
    <PageHeader title="Administração da Matriz" subtitle="Acompanhamento de cadastros, empresas e assinaturas" />
    {access.isPending ? <p role="status">Verificando acesso…</p> : access.isError ?
      <p role="alert">Não foi possível verificar o acesso. <Button variant="outline" onClick={() => void access.refetch()}>Tentar novamente</Button></p> :
      !access.data?.allowed ? <Card><CardContent className="p-6">Área exclusiva aos responsáveis autorizados da Matriz.</CardContent></Card> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Consulta administrativa · Atualizado: {date(data?.fetchedAt)}</p>
          <Button variant="outline" disabled={panel.isFetching} onClick={() => void panel.refetch()}>Atualizar painel</Button>
        </div>
        {panel.isError ? <p role="alert">Não foi possível carregar os dados. Use “Atualizar painel” para tentar novamente.</p> : panel.isPending ? <p role="status">Carregando dados…</p> : data && <>
          <div className="grid gap-4 md:grid-cols-3">{[["Usuários cadastrados", data.totals.users], ["Empresas cadastradas", data.totals.companies], ["Registros de assinatura", data.totals.subscriptions]].map(([label, count]) => <Card key={label}><CardContent className="p-6"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-semibold mt-2">{count ?? "Não disponível"}</p></CardContent></Card>)}</div>
          <p className="text-sm text-muted-foreground">Cadastro não confirma pagamento. As assinaturas mostram o estado registrado no ERP; “Ativa” também pode representar acesso institucional. Cada lista exibe até 50 registros por página.</p>
          <Section title="Usuários cadastrados" headers={["Nome", "E-mail", "Cadastro", "Ativação"]} empty={!data.users.length}>
            {data.users.map((row) => <tr key={row.id}><td>{row.name || "—"}</td><td>{row.email || "—"}</td><td>{date(row.createdAt)}</td><td>{row.confirmedAt ? "E-mail confirmado" : "E-mail pendente"}</td></tr>)}
          </Section>
          <Section title="Empresas cadastradas" headers={["Empresa", "ID da empresa", "ID do responsável", "Situação", "Cadastro"]} empty={!data.companies.length}>
            {data.companies.map((row) => <tr key={row.id}><td>{row.razao_social || row.nome}</td><td>{row.id}</td><td>{row.owner_id}</td><td>{STATUS[row.status] || row.status}</td><td>{date(row.created_at)}</td></tr>)}
          </Section>
          <Section title="Assinaturas" headers={["ID da empresa", "ID do plano", "Situação", "Origem", "Último pagamento", "Fim do teste", "Fim do período", "Cancelamento agendado"]} empty={!data.subscriptions.length}>
            {data.subscriptions.map((row) => <tr key={row.id}><td>{row.empresa_id}</td><td>{row.plan_id}</td><td>{STATUS[row.status] || row.status}</td><td>{row.source}</td><td>{row.last_payment_status || "Não informado"}</td><td>{date(row.trial_ends_at)}</td><td>{date(row.current_period_ends_at)}</td><td>{row.cancel_at_period_end ? "Sim" : "Não"}</td></tr>)}
          </Section>
        </>}
        <div className="flex items-center gap-4"><Button variant="outline" disabled={page === 1 || panel.isFetching} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button variant="outline" disabled={!data?.hasNext || panel.isFetching} onClick={() => setPage(page + 1)}>Próxima</Button></div>
      </>}
  </div>;
}

function Section({ title, headers, empty, children }: { title: string; headers: string[]; empty: boolean; children: ReactNode }) {
  return <Card><CardContent className="p-6"><h2 className="font-display text-xl mb-4">{title}</h2>{empty ? <p className="text-sm text-muted-foreground">Nenhum registro nesta página.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left [&_td]:p-3 [&_td]:border-t [&_th]:p-3"><caption className="sr-only">{title}</caption><thead className="bg-muted"><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}</CardContent></Card>;
}
