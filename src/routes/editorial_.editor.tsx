import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileEdit, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getCurrentEditorialMember, type EditorialMember } from "@/features/blog/blog.repository";
import { listRealEditorialEditorOptions, loadRealEditorialEditorForm, type EditorialEditorPostOption } from "@/features/blog/editorial-editor-read-model";
import { availableEditorialCommands, canEditEditorialDraft, planEditorialCommand, type EditorialCommandKind, type EditorialCommandPlan, type EditorialEditorForm } from "@/features/blog/editorial-workflow";

export const Route = createFileRoute("/editorial_/editor")({
  head: () => ({ meta: [
    { title: "Editor Editorial — Read Model | VEJAMAIS ERP" },
    { name: "description", content: "Editor repository-only conectado ao read model real." },
    { name: "robots", content: "noindex, nofollow, noarchive" },
  ] }),
  component: EditorialEditorRoute,
});

type AccessState = { kind: "loading" } | { kind: "signed_out" } | { kind: "denied" } | { kind: "error"; message: string } | { kind: "ready"; member: EditorialMember };
const LABELS: Record<EditorialCommandKind,string> = { save_draft:"Simular salvar draft", submit_review:"Simular envio para revisão", request_changes:"Simular solicitar ajustes", approve_revision:"Simular aprovação", return_to_draft:"Simular retorno para draft", schedule:"Simular agendamento", publish:"Simular publicação", archive:"Simular arquivamento", restore_draft:"Simular restauração" };

function EditorialEditorRoute() {
  const { user, loading } = useAuth();
  const [access,setAccess] = useState<AccessState>({ kind:"loading" });
  useEffect(() => {
    let cancelled=false;
    if (loading) return;
    if (!user) { setAccess({kind:"signed_out"}); return; }
    getCurrentEditorialMember(user.id).then((member)=>{ if(!cancelled) setAccess(member?{kind:"ready",member}:{kind:"denied"}); }).catch((error)=>{ if(!cancelled) setAccess({kind:"error",message:error instanceof Error?error.message:"Falha ao validar acesso."}); });
    return ()=>{cancelled=true};
  },[loading,user]);
  if (loading || access.kind==="loading") return <Message title="Validando acesso ao editor"/>;
  if (access.kind==="signed_out") return <Message title="Editor protegido" description="Entre com uma conta editorial."/>;
  if (access.kind==="denied") return <Message title="Conta sem acesso editorial" description="Papéis do ERP não concedem acesso a esta área."/>;
  if (access.kind==="error") return <Message title="Falha ao carregar editor" description={access.message}/>;
  return <RealReadModelEditor member={access.member} userId={user!.id}/>;
}

function RealReadModelEditor({member,userId}:{member:EditorialMember;userId:string}) {
  const [options,setOptions]=useState<EditorialEditorPostOption[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [form,setForm]=useState<EditorialEditorForm|null>(null);
  const [error,setError]=useState("");
  const [lastPlan,setLastPlan]=useState<EditorialCommandPlan|null>(null);

  useEffect(()=>{ let cancelled=false; listRealEditorialEditorOptions().then((rows)=>{ if(cancelled)return; setOptions(rows); setSelectedId((current)=>current||rows[0]?.id||""); }).catch((e)=>setError(e instanceof Error?e.message:"Falha ao listar artigos.")); return()=>{cancelled=true}; },[]);
  useEffect(()=>{ if(!selectedId){setForm(null);return;} let cancelled=false; loadRealEditorialEditorForm(selectedId).then((value)=>{if(!cancelled){setForm(value);setLastPlan(null);}}).catch((e)=>setError(e instanceof Error?e.message:"Falha ao carregar artigo.")); return()=>{cancelled=true}; },[selectedId]);

  const actor=useMemo(()=>({userId,role:member.role,authorId:member.authorId}),[userId,member.role,member.authorId]);
  const editable=form?canEditEditorialDraft(actor,form):false;
  const commands=form?availableEditorialCommands(actor,form):[];
  const simulate=(command:EditorialCommandKind)=>{ if(!form)return; setLastPlan(planEditorialCommand(actor,form,command)); };

  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-mint p-2.5 text-primary-deep"><FileEdit className="size-5"/></div><div><p className="font-display text-lg font-semibold text-petrol">Editor Editorial V2</p><p className="text-xs text-muted-foreground">Fase 3-T · read model real · repository-only</p></div></div><Link to="/editorial" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4"/>Painel editorial</Link></div></header>
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <section className="rounded-3xl border bg-card/60 p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div><h1 className="font-display text-3xl font-bold text-petrol">Artigo real carregado sem persistência</h1><p className="mt-3 max-w-3xl text-muted-foreground">Os dados abaixo vêm de `blog_posts` e relações editoriais reais. Alterações ficam apenas em memória; nenhuma operação de escrita é executada.</p></div><div className="rounded-2xl border bg-background p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4 text-primary"/>Persistência bloqueada</div><div className="mt-2 flex items-center gap-2 text-muted-foreground"><ShieldCheck className="size-4"/>RLS continua autoridade</div></div></div></section>
      {error && <div className="mt-6 rounded-2xl border p-4 text-sm">{error}</div>}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border bg-card/60 p-6"><div className="grid gap-5 md:grid-cols-2">
          <Field label="Artigo real"><select value={selectedId} onChange={(e)=>setSelectedId(e.target.value)} className={input()}><option value="">Selecione</option>{options.map((o)=><option key={o.id} value={o.id}>{o.title} · {o.status} · rev {o.revisionNumber}</option>)}</select></Field>
          <Field label="Status"><div className="flex h-11 items-center rounded-xl border bg-muted/40 px-3 text-sm capitalize">{form?.status??"—"}</div></Field>
          <Field label="Título"><input value={form?.title??""} disabled={!editable} onChange={(e)=>patch(form,setForm,"title",e.target.value)} className={input()}/></Field>
          <Field label="Slug"><input value={form?.slug??""} disabled={!editable} onChange={(e)=>patch(form,setForm,"slug",e.target.value)} className={input()}/></Field>
          <Field label="Categoria"><input value={form?.category??""} disabled className={input()}/></Field>
          <Field label="Autor"><input value={form?.author??""} disabled className={input()}/></Field>
          <div className="md:col-span-2"><Field label="Resumo"><textarea value={form?.excerpt??""} disabled={!editable} onChange={(e)=>patch(form,setForm,"excerpt",e.target.value)} className={`${input()} min-h-24 py-3`}/></Field></div>
          <div className="md:col-span-2"><Field label="Conteúdo estruturado"><textarea value={form?.sections.flatMap(s=>[s.heading,...s.paragraphs]).join("\n\n")??""} disabled className={`${input()} min-h-48 py-3`}/></Field></div>
          <Field label="Revisão"><div className="flex h-11 items-center rounded-xl border bg-muted/40 px-3 text-sm">#{form?.revisionNumber??"—"}</div></Field>
          <Field label="Última decisão"><div className="flex h-11 items-center rounded-xl border bg-muted/40 px-3 text-sm">{form?.latestReviewDecision??"sem decisão"}</div></Field>
        </div></section>
        <aside className="space-y-6"><section className="rounded-3xl border bg-card/60 p-5"><h2 className="font-display text-xl font-semibold">Workflow simulado</h2><p className="mt-2 text-sm text-muted-foreground">Comandos calculam somente o contrato; não persistem.</p><div className="mt-4 space-y-2">{commands.map((c)=><button key={c} type="button" onClick={()=>simulate(c)} className="w-full rounded-xl border bg-background px-4 py-3 text-left text-sm font-semibold">{LABELS[c]}</button>)}</div></section><section className="rounded-3xl border bg-card/60 p-5"><h2 className="font-display text-xl font-semibold">Último plano</h2><p className="mt-3 text-sm text-muted-foreground">{lastPlan?`${lastPlan.fromStatus} → ${lastPlan.toStatus} · ${lastPlan.persistence}`:"Nenhuma simulação executada."}</p></section></aside>
      </div>
    </main>
  </div>;
}

function patch<K extends keyof EditorialEditorForm>(form:EditorialEditorForm|null,setter:React.Dispatch<React.SetStateAction<EditorialEditorForm|null>>,key:K,value:EditorialEditorForm[K]){if(form)setter({...form,[key]:value});}
function input(){return "h-11 w-full rounded-xl border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70";}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>{children}</label>;}
function Message({title,description="Conferindo sessão e membership editorial."}:{title:string;description?:string}){return <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center"><div className="max-w-xl rounded-3xl border bg-card/60 p-9"><h1 className="font-display text-3xl font-bold text-petrol">{title}</h1><p className="mt-3 text-muted-foreground">{description}</p></div></main>;}
