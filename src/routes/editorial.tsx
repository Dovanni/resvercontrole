import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileClock,
  FileText,
  Filter,
  History,
  LockKeyhole,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
} from "lucide-react";
import { BlogEditorialSignInForm, useBlogEditorialAuth } from "@/features/blog/blog-editorial-auth";
import type { BlogPostStatus } from "@/features/blog/types";
import {
  getEditorialPostReadModel,
  loadEditorialAdministrativeReadModel,
  type EditorialAdministrativeReadModel,
  type EditorialPostReadModel,
} from "@/features/blog/editorial-read-model";

export const Route = createFileRoute("/editorial")({
  head: () => ({
    meta: [
      { title: "Editorial | VEJAMAIS ERP" },
      { name: "description", content: "Área editorial protegida do VEJAMAIS ERP." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: EditorialRoute,
});

type EditorialState =
  | { kind: "idle" | "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready"; model: EditorialAdministrativeReadModel };

const STATUS_OPTIONS: Array<{ value: "all" | BlogPostStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Revisão" },
  { value: "scheduled", label: "Agendados" },
  { value: "published", label: "Publicados" },
  { value: "archived", label: "Arquivados" },
];

function EditorialRoute() {
  const { user, loading: authLoading } = useBlogEditorialAuth();
  const [state, setState] = useState<EditorialState>({ kind: "idle" });
  const [statusFilter, setStatusFilter] = useState<"all" | BlogPostStatus>("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EditorialPostReadModel | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setState({ kind: "idle" });
      return;
    }

    setState({ kind: "loading" });
    loadEditorialAdministrativeReadModel()
      .then((model) => {
        if (cancelled) return;
        setState({ kind: "ready", model });
        setSelectedPostId((current) => current ?? model.posts[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Não foi possível carregar o contexto editorial.";
        setState(message === "BLOG_EDITORIAL_ACCESS_DENIED" ? { kind: "denied" } : { kind: "error", message });
      });

    return () => { cancelled = true; };
  }, [authLoading, user]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedPostId || state.kind !== "ready") {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    getEditorialPostReadModel(selectedPostId)
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPostId, state.kind]);

  const filteredPosts = useMemo(() => {
    if (state.kind !== "ready") return [];
    return statusFilter === "all" ? state.model.posts : state.model.posts.filter((post) => post.status === statusFilter);
  }, [state, statusFilter]);

  if (authLoading || state.kind === "loading") {
    return <EditorialMessage title="Validando acesso editorial" description="Conferindo sua sessão exclusiva do Blog, membership e permissões de leitura." />;
  }
  if (!user) {
    return <EditorialMessage icon={<LockKeyhole className="size-7" />} title="Acesso editorial protegido" description="Entre com uma conta cadastrada no Blog Editorial. Esta autenticação é independente do ERP."><BlogEditorialSignInForm /></EditorialMessage>;
  }
  if (state.kind === "denied") {
    return <EditorialMessage icon={<ShieldCheck className="size-7" />} title="Conta sem papel editorial" description="Sua sessão do Blog está autenticada, mas não existe membership editorial ativo para esta conta."><Link to="/blog" className="text-sm font-semibold text-primary hover:underline">Voltar ao Blog</Link></EditorialMessage>;
  }
  if (state.kind === "error") return <EditorialMessage title="Não foi possível validar o painel" description={state.message} />;
  if (state.kind !== "ready") return null;

  const { model } = state;
  const counts = countStatuses(model.posts);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint p-2.5 text-primary-deep"><BookOpen className="size-5" /></div>
            <div><p className="font-display text-lg font-semibold text-petrol">VEJAMAIS ERP Editorial</p><p className="text-xs text-muted-foreground">Painel administrativo · consulta e acompanhamento</p></div>
          </div>
          <div className="flex items-center gap-3"><span className="hidden rounded-full border px-3 py-1 text-xs font-semibold capitalize text-muted-foreground sm:inline-flex">{model.member.role}</span><Link to="/editorial/editor" className="text-sm font-semibold text-primary hover:underline">Abrir editor</Link><Link to="/blog" className="text-sm font-semibold text-primary hover:underline">Ver Blog</Link></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operação editorial</p><h1 className="mt-3 max-w-3xl font-display text-4xl font-bold tracking-tight text-petrol md:text-5xl">Painel editorial administrativo</h1><p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Acompanhe artigos, catálogos, revisões e eventos de workflow protegidos por RLS. Este painel é dedicado à consulta; criação, edição e publicação ficam no Editor Editorial V2.</p></div>
          <div className="rounded-2xl border bg-card p-4 text-sm shadow-sm"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-primary" /> Read model ativo</div><div className="mt-2 flex items-center gap-2 text-muted-foreground"><BookOpen className="size-4" /> Escrita disponível no editor</div></div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<FileText className="size-5" />} label="Artigos" value={model.posts.length} />
          <MetricCard icon={<Tags className="size-5" />} label="Categorias" value={model.catalog.categories.length} />
          <MetricCard icon={<Tags className="size-5" />} label="Tags" value={model.catalog.tags.length} />
          <MetricCard icon={<Users className="size-5" />} label="Autores" value={model.catalog.authors.length} />
        </section>

        <section className="mt-8 rounded-3xl border bg-card/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><Filter className="size-5 text-primary" /><h2 className="font-display text-2xl font-semibold">Artigos</h2></div><p className="mt-1 text-sm text-muted-foreground">Filtre pelo estado atual do workflow.</p></div><div className="flex flex-wrap gap-2">{STATUS_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setStatusFilter(option.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === option.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{option.label}{option.value !== "all" ? ` · ${counts[option.value]}` : ""}</button>)}</div></div>

          <div className="mt-6 overflow-hidden rounded-2xl border bg-background">
            {filteredPosts.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum artigo encontrado neste status.</div> : filteredPosts.map((post) => <button key={post.id} type="button" onClick={() => setSelectedPostId(post.id)} className={`grid w-full gap-2 border-b p-4 text-left last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center ${selectedPostId === post.id ? "bg-muted/60" : "hover:bg-muted/30"}`}><div><p className="font-semibold text-petrol">{post.title}</p><p className="mt-1 text-xs text-muted-foreground">/{post.slug} · rev. {post.revisionNumber} · {post.category ?? "Sem categoria"}</p></div><StatusBadge status={post.status} /><span className="text-xs text-muted-foreground">{formatDate(post.updatedAt)}</span></button>)}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border bg-card/60 p-6 shadow-sm">
            <div className="flex items-center gap-2"><History className="size-5 text-primary" /><h2 className="font-display text-2xl font-semibold">Detalhe e timeline</h2></div>
            {detailLoading ? <p className="mt-6 text-sm text-muted-foreground">Carregando histórico editorial…</p> : !detail ? <p className="mt-6 text-sm text-muted-foreground">Selecione um artigo para consultar revisões, reviews e workflow.</p> : <div className="mt-6 space-y-6"><div className="rounded-2xl border bg-background p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-petrol">{detail.post.title}</p><p className="mt-1 text-xs text-muted-foreground">Revisão atual {detail.post.revisionNumber} · {detail.post.author ?? "Autor não vinculado"}</p></div><StatusBadge status={detail.post.status} /></div></div><TimelineSection title="Workflow" icon={<FileClock className="size-4" />} items={detail.workflow.map((event) => ({ id: event.id, title: `${event.fromStatus ?? "início"} → ${event.toStatus}`, meta: `${formatDate(event.createdAt)}${event.actorUserId ? ` · ${shortId(event.actorUserId)}` : ""}`, note: event.note }))} empty="Nenhum evento de workflow." /><TimelineSection title="Reviews" icon={<ShieldCheck className="size-4" />} items={detail.reviews.map((review) => ({ id: review.id, title: `${review.decision === "approved" ? "Aprovado" : "Ajustes solicitados"} · revisão ${review.revisionNumber}`, meta: `${formatDate(review.createdAt)} · ${shortId(review.reviewerUserId)}`, note: review.notes }))} empty="Nenhuma decisão de review." /><TimelineSection title="Revisões" icon={<History className="size-4" />} items={detail.revisions.map((revision) => ({ id: revision.id, title: `Revisão ${revision.revisionNumber}`, meta: `${formatDate(revision.createdAt)}${revision.createdBy ? ` · ${shortId(revision.createdBy)}` : ""}`, note: revision.reason }))} empty="Nenhum snapshot de revisão." /></div>}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border bg-card/60 p-6 shadow-sm"><div className="flex items-center gap-2"><UserRound className="size-5 text-primary" /><h2 className="font-display text-2xl font-semibold">Seu acesso</h2></div><dl className="mt-5 space-y-3 text-sm"><InfoRow label="Papel" value={model.member.role} /><InfoRow label="Membership" value={model.member.active ? "Ativo" : "Inativo"} /><InfoRow label="Perfil de autor" value={model.member.authorId ? "Vinculado" : "Não vinculado"} /><InfoRow label="Snapshot" value={formatDate(model.loadedAt)} /></dl></div>
            <div className="rounded-3xl border bg-card/60 p-6 shadow-sm"><div className="flex items-center gap-2"><CalendarClock className="size-5 text-primary" /><h2 className="font-display text-2xl font-semibold">Catálogo</h2></div><div className="mt-5 space-y-4 text-sm"><CatalogList label="Categorias" items={model.catalog.categories.map((item) => item.name)} /><CatalogList label="Autores" items={model.catalog.authors.map((item) => item.displayName)} /><CatalogList label="Tags" items={model.catalog.tags.map((item) => item.name)} /></div></div>
            <div className="flex items-start gap-2 rounded-2xl border border-dashed p-4 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 size-4 shrink-0" />Este painel contém somente consultas administrativas. Para criar, editar, revisar, agendar ou publicar conteúdo, use o Editor Editorial V2.</div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function countStatuses(posts: EditorialAdministrativeReadModel["posts"]): Record<BlogPostStatus, number> {
  return posts.reduce((acc, post) => ({ ...acc, [post.status]: acc[post.status] + 1 }), { draft: 0, review: 0, scheduled: 0, published: 0, archived: 0 });
}
function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="rounded-xl bg-mint p-2 text-primary-deep">{icon}</div><span className="font-display text-3xl font-semibold text-petrol">{value}</span></div><p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p></div>; }
function StatusBadge({ status }: { status: BlogPostStatus }) { return <span className="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">{status}</span>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold capitalize">{value}</dd></div>; }
function CatalogList({ label, items }: { label: string; items: string[] }) { return <div><p className="font-semibold">{label}</p><p className="mt-1 leading-6 text-muted-foreground">{items.length ? items.join(" · ") : "Nenhum registro"}</p></div>; }
function TimelineSection({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: Array<{ id: string; title: string; meta: string; note: string | null }>; empty: string }) { return <div><div className="flex items-center gap-2 font-semibold">{icon}{title}</div><div className="mt-3 space-y-3">{items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : items.map((item) => <div key={item.id} className="rounded-2xl border bg-background p-4"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>{item.note && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.note}</p>}</div>)}</div></div>; }
function formatDate(value: string) { try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function shortId(value: string) { return value.length > 12 ? `${value.slice(0, 8)}…` : value; }
function EditorialMessage({ icon, title, description, children }: { icon?: React.ReactNode; title: string; description: string; children?: React.ReactNode }) { return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center"><div className="max-w-xl rounded-3xl border bg-card/60 p-8 shadow-sm sm:p-10"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mint text-primary-deep">{icon ?? <BookOpen className="size-7" />}</div><h1 className="mt-5 font-display text-3xl font-bold text-petrol">{title}</h1><p className="mt-3 leading-7 text-muted-foreground">{description}</p>{children && <div className="mt-6">{children}</div>}</div></main>; }
