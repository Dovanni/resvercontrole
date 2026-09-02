import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  getCurrentEditorialMember,
  getEditorialDashboardSnapshot,
  type EditorialDashboardSnapshot,
  type EditorialMember,
} from "@/features/blog/blog.repository";

export const Route = createFileRoute("/editorial")({
  head: () => ({
    meta: [
      { title: "Editorial | VEJAMAIS ERP" },
      {
        name: "description",
        content: "Área editorial protegida do VEJAMAIS ERP.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: EditorialRoute,
});

type EditorialState =
  | { kind: "idle" | "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready"; member: EditorialMember; snapshot: EditorialDashboardSnapshot };

function EditorialRoute() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<EditorialState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return;
    if (!user) {
      setState({ kind: "idle" });
      return;
    }

    setState({ kind: "loading" });
    Promise.all([getCurrentEditorialMember(user.id), getEditorialDashboardSnapshot()])
      .then(([member, snapshot]) => {
        if (cancelled) return;
        if (!member) {
          setState({ kind: "denied" });
          return;
        }
        setState({ kind: "ready", member, snapshot });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Não foi possível carregar o contexto editorial.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  if (authLoading || state.kind === "loading") {
    return <EditorialMessage title="Validando acesso editorial" description="Conferindo sua sessão e permissões com as políticas do banco." />;
  }

  if (!user) {
    return (
      <EditorialMessage
        icon={<LockKeyhole className="size-7" />}
        title="Acesso editorial protegido"
        description="Entre com uma conta que faça parte da equipe editorial do VEJAMAIS ERP. Papéis administrativos de empresas não concedem acesso a esta área."
      >
        <Link to="/login" className="inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Entrar
        </Link>
      </EditorialMessage>
    );
  }

  if (state.kind === "denied") {
    return (
      <EditorialMessage
        icon={<ShieldCheck className="size-7" />}
        title="Conta sem papel editorial"
        description="Sua sessão está autenticada, mas não existe um membership editorial ativo para esta conta. Nenhum papel do ERP é convertido automaticamente em permissão editorial."
      >
        <Link to="/blog" className="text-sm font-semibold text-primary hover:underline">
          Voltar ao Blog
        </Link>
      </EditorialMessage>
    );
  }

  if (state.kind === "error") {
    return (
      <EditorialMessage
        title="Não foi possível validar o painel"
        description={state.message}
      />
    );
  }

  if (state.kind !== "ready") return null;

  const { member, snapshot } = state;
  const totalPosts = Object.values(snapshot.posts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint p-2.5 text-primary-deep">
              <BookOpen className="size-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-petrol">VEJAMAIS ERP Editorial</p>
              <p className="text-xs text-muted-foreground">Área institucional isolada do contexto multiempresa</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
              {member.role}
            </span>
            <Link to="/blog" className="text-sm font-semibold text-primary hover:underline">Ver preview</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Fase 3-L · Repository-only</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold tracking-tight text-petrol md:text-5xl">
              Painel editorial conectado em modo somente leitura
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Esta primeira integração valida sessão, membership e leitura das tabelas editoriais. Criação, edição, revisão e publicação continuam desabilitadas no frontend nesta fase.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 text-sm shadow-sm">
            <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-primary" /> RLS ativa</div>
            <div className="mt-2 flex items-center gap-2 text-muted-foreground"><LockKeyhole className="size-4" /> Sem comandos de escrita</div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo editorial">
          <MetricCard icon={<FileText className="size-5" />} label="Artigos" value={totalPosts} />
          <MetricCard icon={<Database className="size-5" />} label="Categorias" value={snapshot.categories} />
          <MetricCard icon={<Tags className="size-5" />} label="Tags" value={snapshot.tags} />
          <MetricCard icon={<Users className="size-5" />} label="Autores" value={snapshot.authors} />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div className="rounded-3xl border bg-card/60 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h2 className="font-display text-2xl font-semibold">Workflow</h2>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatusCard label="Draft" value={snapshot.posts.draft} />
              <StatusCard label="Revisão" value={snapshot.posts.review} />
              <StatusCard label="Agendados" value={snapshot.posts.scheduled} />
              <StatusCard label="Publicados" value={snapshot.posts.published} />
              <StatusCard label="Arquivados" value={snapshot.posts.archived} />
            </div>
            <div className="mt-6 rounded-2xl border border-dashed bg-background p-4 text-sm leading-6 text-muted-foreground">
              Os três artigos do preview permanecem no repositório local como <strong className="text-foreground">drafts</strong>. Nenhum deles foi importado para `blog_posts` nesta fase.
            </div>
          </div>

          <aside className="rounded-3xl border bg-card/60 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="font-display text-2xl font-semibold">Seu acesso</h2>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Papel editorial</dt>
                <dd className="mt-1 font-semibold capitalize">{member.role}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Membership</dt>
                <dd className="mt-1 font-semibold">{member.active ? "Ativo" : "Inativo"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Perfil de autor</dt>
                <dd className="mt-1 font-semibold">{member.authorId ? "Vinculado" : "Não vinculado"}</dd>
              </div>
            </dl>
            <div className="mt-6 flex items-start gap-2 rounded-2xl bg-muted/60 p-4 text-xs leading-5 text-muted-foreground">
              <Clock3 className="mt-0.5 size-4 shrink-0" />
              Ações de escrita serão adicionadas apenas em fase posterior, com contratos de formulário e workflow próprios.
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-xl bg-mint p-2 text-primary-deep">{icon}</div>
        <span className="font-display text-3xl font-semibold text-petrol">{value}</span>
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-petrol">{value}</p>
    </div>
  );
}

function EditorialMessage({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-center">
      <div className="max-w-xl rounded-3xl border bg-card/60 p-8 shadow-sm sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mint text-primary-deep">
          {icon ?? <BookOpen className="size-7" />}
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold text-petrol">{title}</h1>
        <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </main>
  );
}
