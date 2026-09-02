import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, FileEdit, FlaskConical, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getCurrentEditorialMember, listPreviewBlogArticles, type EditorialMember } from "@/features/blog/blog.repository";
import {
  articleToEditorialForm,
  availableEditorialCommands,
  canEditEditorialDraft,
  planEditorialCommand,
  simulateEditorialCommand,
  type EditorialCommandKind,
  type EditorialCommandPlan,
  type EditorialEditorForm,
} from "@/features/blog/editorial-workflow";

export const Route = createFileRoute("/editorial/editor")({
  head: () => ({
    meta: [
      { title: "Editor Editorial — Protótipo | VEJAMAIS ERP" },
      { name: "description", content: "Protótipo repository-only do editor editorial VEJAMAIS ERP." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: EditorialEditorRoute,
});

type AccessState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready"; member: EditorialMember };

const COMMAND_LABELS: Record<EditorialCommandKind, string> = {
  save_draft: "Simular salvar draft",
  submit_review: "Simular envio para revisão",
  request_changes: "Simular solicitar ajustes",
  approve_revision: "Simular aprovação",
  return_to_draft: "Simular retorno para draft",
  schedule: "Simular agendamento",
  publish: "Simular publicação",
  archive: "Simular arquivamento",
  restore_draft: "Simular restauração para draft",
};

function EditorialEditorRoute() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<AccessState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setAccess({ kind: "signed_out" });
      return;
    }

    setAccess({ kind: "loading" });
    getCurrentEditorialMember(user.id)
      .then((member) => {
        if (cancelled) return;
        setAccess(member ? { kind: "ready", member } : { kind: "denied" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAccess({ kind: "error", message: error instanceof Error ? error.message : "Falha ao validar acesso editorial." });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  if (authLoading || access.kind === "loading") return <AccessMessage title="Validando acesso ao editor" />;
  if (access.kind === "signed_out") {
    return <AccessMessage title="Editor protegido" description="Entre com uma conta que possua membership editorial ativo." link="/login" linkLabel="Entrar" />;
  }
  if (access.kind === "denied") {
    return <AccessMessage title="Conta sem acesso editorial" description="Papéis do ERP não concedem acesso automático ao editor institucional." link="/blog" linkLabel="Voltar ao Blog" />;
  }
  if (access.kind === "error") return <AccessMessage title="Falha ao validar o editor" description={access.message} />;

  return <RepositoryOnlyEditor member={access.member} userId={user!.id} />;
}

function RepositoryOnlyEditor({ member, userId }: { member: EditorialMember; userId: string }) {
  const previewArticles = useMemo(() => listPreviewBlogArticles(), []);
  const [selectedId, setSelectedId] = useState(previewArticles[0]?.id ?? "");
  const selectedArticle = previewArticles.find((article) => article.id === selectedId) ?? previewArticles[0];
  const [form, setForm] = useState<EditorialEditorForm>(() => seedForm(selectedArticle, userId));
  const [lastPlan, setLastPlan] = useState<EditorialCommandPlan | null>(null);

  useEffect(() => {
    setForm(seedForm(selectedArticle, userId));
    setLastPlan(null);
  }, [selectedArticle, userId]);

  const actor = useMemo(
    () => ({ userId, role: member.role, authorId: member.authorId }),
    [member.authorId, member.role, userId],
  );
  const editable = canEditEditorialDraft(actor, form);
  const commands = availableEditorialCommands(actor, form);
  const categories = useMemo(() => Array.from(new Set(previewArticles.map((article) => article.category))), [previewArticles]);

  const runSimulation = (command: EditorialCommandKind) => {
    const plan = planEditorialCommand(actor, form, command);
    setLastPlan(plan);
    if (!plan.allowedByClientContract) return;

    let next = simulateEditorialCommand(form, plan);
    if (command === "approve_revision") {
      next = { ...next, latestReviewDecision: "approved", latestReviewerUserId: userId };
    }
    if (command === "request_changes") {
      next = { ...next, latestReviewDecision: "changes_requested", latestReviewerUserId: userId };
    }
    setForm(next);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint p-2.5 text-primary-deep"><FileEdit className="size-5" /></div>
            <div>
              <p className="font-display text-lg font-semibold text-petrol">Editor Editorial V2</p>
              <p className="text-xs text-muted-foreground">Fase 3-M · laboratório repository-only</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full border px-3 py-1 text-xs font-semibold capitalize text-muted-foreground">{member.role}</span>
            <Link to="/editorial" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <ArrowLeft className="size-4" /> Painel editorial
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <section className="rounded-3xl border bg-card/60 p-5 shadow-sm md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <FlaskConical className="size-4" /> Simulação segura
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold text-petrol md:text-4xl">Editor e workflow sem persistência</h1>
              <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
                Todos os botões abaixo calculam contratos e transições apenas em memória. Não há insert, update, delete, upload ou RPC conectado a esta tela.
              </p>
            </div>
            <div className="rounded-2xl border bg-background p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4 text-primary" /> Persistência bloqueada</div>
              <div className="mt-2 flex items-center gap-2 text-muted-foreground"><ShieldCheck className="size-4" /> Banco continua autoridade futura</div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-3xl border bg-card/60 p-5 shadow-sm md:p-7">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Artigo de laboratório">
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className={inputClass()}>
                  {previewArticles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}
                </select>
              </Field>
              <Field label="Status simulado">
                <div className="flex h-11 items-center rounded-xl border bg-muted/40 px-3 text-sm font-semibold capitalize">{form.status}</div>
              </Field>

              <Field label="Título"><input value={form.title} disabled={!editable} onChange={(event) => patch(setForm, "title", event.target.value)} className={inputClass()} /></Field>
              <Field label="Slug"><input value={form.slug} disabled={!editable} onChange={(event) => patch(setForm, "slug", event.target.value)} className={inputClass()} /></Field>
              <Field label="Categoria">
                <select value={form.category} disabled={!editable} onChange={(event) => patch(setForm, "category", event.target.value)} className={inputClass()}>
                  <option value="">Selecione</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </Field>
              <Field label="Autor"><input value={form.author} disabled={!editable} onChange={(event) => patch(setForm, "author", event.target.value)} className={inputClass()} /></Field>

              <div className="md:col-span-2"><Field label="Resumo"><textarea value={form.excerpt} disabled={!editable} onChange={(event) => patch(setForm, "excerpt", event.target.value)} className={`${inputClass()} min-h-24 py-3`} /></Field></div>
              <div className="md:col-span-2"><Field label="Conteúdo estruturado — seção 1"><textarea value={form.sections[0]?.paragraphs.join("\n\n") ?? ""} disabled={!editable} onChange={(event) => setForm((current) => ({ ...current, sections: [{ heading: current.sections[0]?.heading || "Seção principal", paragraphs: event.target.value.split(/\n\s*\n/).filter(Boolean) }, ...current.sections.slice(1)] }))} className={`${inputClass()} min-h-40 py-3`} /></Field></div>

              <Field label="Meta title"><input value={form.metaTitle} disabled={!editable} onChange={(event) => patch(setForm, "metaTitle", event.target.value)} className={inputClass()} /></Field>
              <Field label="Palavra-chave"><input value={form.focusKeyword} disabled={!editable} onChange={(event) => patch(setForm, "focusKeyword", event.target.value)} className={inputClass()} /></Field>
              <div className="md:col-span-2"><Field label="Meta description"><textarea value={form.metaDescription} disabled={!editable} onChange={(event) => patch(setForm, "metaDescription", event.target.value)} className={`${inputClass()} min-h-20 py-3`} /></Field></div>
              <Field label="Alt da imagem"><input value={form.featuredImageAlt} disabled={!editable} onChange={(event) => patch(setForm, "featuredImageAlt", event.target.value)} className={inputClass()} /></Field>
              <Field label="Tempo de leitura"><input type="number" min={1} value={form.readingTimeMinutes} disabled={!editable} onChange={(event) => patch(setForm, "readingTimeMinutes", Number(event.target.value))} className={inputClass()} /></Field>
              <Field label="Agendar para"><input type="datetime-local" value={form.scheduledAt} disabled={!editable || form.status !== "review"} onChange={(event) => patch(setForm, "scheduledAt", event.target.value)} className={inputClass()} /></Field>
              <Field label="Revisão atual"><div className="flex h-11 items-center rounded-xl border bg-muted/40 px-3 text-sm">#{form.revisionNumber} · {form.latestReviewDecision ?? "sem decisão"}</div></Field>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border bg-card/60 p-5 shadow-sm">
              <div className="flex items-center gap-2"><BookOpen className="size-5 text-primary" /><h2 className="font-display text-xl font-semibold">Workflow simulado</h2></div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Os comandos disponíveis refletem o papel editorial e o status atual.</p>
              <div className="mt-5 space-y-2">
                {commands.length ? commands.map((command) => (
                  <button key={command} type="button" onClick={() => runSimulation(command)} className="w-full rounded-xl border bg-background px-4 py-3 text-left text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary">
                    {COMMAND_LABELS[command]}
                  </button>
                )) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum comando disponível neste estado.</p>}
              </div>
            </section>

            <section className="rounded-3xl border bg-card/60 p-5 shadow-sm">
              <h2 className="font-display text-xl font-semibold">Último plano</h2>
              {!lastPlan ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Execute uma simulação para validar o contrato do comando.</p>
              ) : (
                <div className="mt-4 space-y-4 text-sm">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="font-semibold">{lastPlan.fromStatus} → {lastPlan.toStatus}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{lastPlan.persistence}</p>
                  </div>
                  {lastPlan.allowedByClientContract ? (
                    <div className="flex items-start gap-2 rounded-xl border p-3 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Contrato do cliente aprovado. Persistência continua bloqueada.</div>
                  ) : (
                    <div className="space-y-2">
                      {lastPlan.issues.map((current) => <div key={`${current.field}-${current.code}`} className="rounded-xl border p-3"><p className="font-semibold">{current.code}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{current.message}</p></div>)}
                    </div>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function seedForm(article: ReturnType<typeof listPreviewBlogArticles>[number] | undefined, userId: string) {
  if (!article) throw new Error("BLOG_PREVIEW_ARTICLE_REQUIRED");
  return { ...articleToEditorialForm(article), createdByUserId: userId };
}

function patch<K extends keyof EditorialEditorForm>(setter: React.Dispatch<React.SetStateAction<EditorialEditorForm>>, key: K, value: EditorialEditorForm[K]) {
  setter((current) => ({ ...current, [key]: value }));
}

function inputClass() {
  return "h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>{children}</label>;
}

function AccessMessage({ title, description = "Conferindo sessão e membership editorial.", link, linkLabel }: { title: string; description?: string; link?: "/login" | "/blog"; linkLabel?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center">
      <div className="max-w-xl rounded-3xl border bg-card/60 p-9 shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mint text-primary-deep"><ShieldCheck className="size-7" /></div>
        <h1 className="mt-5 font-display text-3xl font-bold text-petrol">{title}</h1>
        <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
        {link && linkLabel && <Link to={link} className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">{linkLabel}</Link>}
      </div>
    </main>
  );
}
