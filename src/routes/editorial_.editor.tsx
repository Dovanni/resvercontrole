import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileEdit, ShieldCheck } from "lucide-react";
import { useBlogEditorialAuth } from "@/features/blog/blog-editorial-auth";
import { getCurrentEditorialMember, type EditorialMember } from "@/features/blog/blog.repository";
import { BLOG_SEO_PERSISTENCE_READY } from "@/features/blog/blog-seo-persistence-readiness";
import { blogPostStatusLabel, editorialRoleLabel, revisionLabel } from "@/features/blog/editorial-localization";
import {
  listRealEditorialEditorOptions,
  loadRealEditorialEditorForm,
  type EditorialEditorPostOption,
} from "@/features/blog/editorial-editor-read-model";
import { loadEditorialReferenceCatalog, type EditorialAdministrativeReadModel } from "@/features/blog/editorial-read-model";
import {
  editorialSectionsToText,
  editorialTextToSections,
  parseEditorialTagInput,
} from "@/features/blog/editorial-editor-input";
import {
  availableEditorialCommands,
  canEditEditorialDraft,
  createEmptyEditorialForm,
  type EditorialCommandKind,
  type EditorialEditorForm,
} from "@/features/blog/editorial-workflow";
import {
  EDITORIAL_OPERATIONAL_WRITE_MODE,
  executeOperationalEditorialCommand,
} from "@/features/blog/editorial-operational-write";
import { getBlogMediaPublicUrl, uploadFeaturedImage } from "@/features/blog/blog-media";

export const Route = createFileRoute("/editorial_/editor")({
  head: () => ({ meta: [
    { title: "Editor Editorial | VEJAMAIS ERP" },
    { name: "description", content: "Editor operacional protegido do Blog Editorial VEJAMAIS ERP." },
    { name: "robots", content: "noindex, nofollow, noarchive" },
  ] }),
  component: EditorialEditorRoute,
});

type AccessState = { kind: "loading" } | { kind: "signed_out" } | { kind: "denied" } | { kind: "error"; message: string } | { kind: "ready"; member: EditorialMember };
type Catalog = EditorialAdministrativeReadModel["catalog"];

const LABELS: Record<EditorialCommandKind, string> = {
  save_draft: "Salvar rascunho",
  submit_review: "Enviar para revisão",
  request_changes: "Solicitar ajustes",
  approve_revision: "Aprovar revisão",
  return_to_draft: "Retornar para rascunho",
  schedule: "Agendar publicação",
  publish: "Publicar agora",
  archive: "Arquivar",
  restore_draft: "Restaurar como rascunho",
};

function EditorialEditorRoute() {
  const { user, loading } = useBlogEditorialAuth();
  const [access, setAccess] = useState<AccessState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) { setAccess({ kind: "signed_out" }); return; }
    getCurrentEditorialMember(user.id)
      .then((member) => { if (!cancelled) setAccess(member ? { kind: "ready", member } : { kind: "denied" }); })
      .catch((error) => { if (!cancelled) setAccess({ kind: "error", message: error instanceof Error ? error.message : "Falha ao validar acesso." }); });
    return () => { cancelled = true; };
  }, [loading, user]);

  if (loading || access.kind === "loading") return <Message title="Validando acesso ao editor" />;
  if (access.kind === "signed_out") return <Message title="Editor protegido" description="Autentique-se primeiro em /editorial com uma conta do Blog Editorial." />;
  if (access.kind === "denied") return <Message title="Conta sem acesso editorial" description="A sessão do Blog está ativa, mas não existe vínculo editorial válido para esta conta." />;
  if (access.kind === "error") return <Message title="Falha ao carregar editor" description={access.message} />;
  return <OperationalEditor member={access.member} userId={user!.id} />;
}

function OperationalEditor({ member, userId }: { member: EditorialMember; userId: string }) {
  const [options, setOptions] = useState<EditorialEditorPostOption[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<EditorialEditorForm | null>(null);
  const [contentText, setContentText] = useState("");
  const [tagText, setTagText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function syncEditorForm(value: EditorialEditorForm) {
    setForm(value);
    setContentText(editorialSectionsToText(value.sections));
    setTagText(value.tags.join(", "));
  }

  async function refreshOptions(preferredId?: string) {
    const rows = await listRealEditorialEditorOptions();
    setOptions(rows);
    const nextId = preferredId ?? selectedId ?? rows[0]?.id ?? "";
    setSelectedId(nextId);
    return nextId;
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRealEditorialEditorOptions(), loadEditorialReferenceCatalog()])
      .then(([rows, loadedCatalog]) => {
        if (cancelled) return;
        setOptions(rows);
        setCatalog(loadedCatalog);
        if (rows[0]?.id) setSelectedId(rows[0].id);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Falha ao carregar o editor."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    loadRealEditorialEditorForm(selectedId)
      .then((value) => { if (!cancelled) { syncEditorForm(value); setPendingImage(null); setReviewNotes(""); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Falha ao carregar artigo."); });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (!pendingImage) {
      setPendingImagePreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(pendingImage);
    setPendingImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [pendingImage]);

  const actor = useMemo(() => ({ userId, role: member.role, authorId: member.authorId }), [userId, member.role, member.authorId]);
  const editable = form ? canEditEditorialDraft(actor, form) : false;
  const commands = form ? availableEditorialCommands(actor, form) : [];
  const featuredImageUrl = form?.featuredImagePath ? getBlogMediaPublicUrl(form.featuredImagePath) : "";
  const imagePreviewUrl = pendingImagePreviewUrl || featuredImageUrl;
  const seoControlsEnabled = editable && BLOG_SEO_PERSISTENCE_READY;

  function createNewDraft() {
    if (!catalog) return;
    const next = createEmptyEditorialForm();
    next.category = catalog.categories[0]?.name ?? "";
    next.author = catalog.authors[0]?.displayName ?? "";
    next.createdByUserId = userId;
    setSelectedId("");
    syncEditorForm(next);
    setPendingImage(null);
    setError("");
    setSuccess("");
  }

  async function uploadImage(file?: File) {
    if (!form || !file) return;
    setError("");
    setSuccess("");
    if (!form.id) {
      setPendingImage(file);
      setSuccess(`Arquivo ${file.name} selecionado. A imagem será enviada automaticamente ao salvar o rascunho.`);
      return;
    }
    setMediaBusy(true);
    try {
      const uploaded = await uploadFeaturedImage(form.id, file);
      setForm({ ...form, featuredImagePath: uploaded.path });
      setSuccess("Imagem destacada enviada. Salve o rascunho para persistir a referência da imagem no artigo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar a imagem destacada.");
    } finally {
      setMediaBusy(false);
    }
  }

  async function execute(command: EditorialCommandKind) {
    if (!form) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const effectiveForm: EditorialEditorForm = {
        ...form,
        sections: editorialTextToSections(contentText),
        tags: parseEditorialTagInput(tagText),
      };
      let result = await executeOperationalEditorialCommand({ actor, form: effectiveForm, command, reviewNotes });

      if (command === "save_draft" && pendingImage) {
        setMediaBusy(true);
        const uploaded = await uploadFeaturedImage(result.postId, pendingImage);
        const persisted = await loadRealEditorialEditorForm(result.postId);
        const imageForm: EditorialEditorForm = {
          ...persisted,
          featuredImagePath: uploaded.path,
          featuredImageAlt: effectiveForm.featuredImageAlt,
          sections: effectiveForm.sections,
          tags: effectiveForm.tags,
        };
        result = await executeOperationalEditorialCommand({ actor, form: imageForm, command: "save_draft", reviewNotes });
        setPendingImage(null);
      }

      setSuccess(`${LABELS[command]} concluído com sucesso.`);
      const id = await refreshOptions(result.postId);
      if (id) syncEditorForm(await loadRealEditorialEditorForm(id));
      setReviewNotes("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na operação editorial.");
    } finally {
      setBusy(false);
      setMediaBusy(false);
    }
  }

  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-mint p-2.5 text-primary-deep"><FileEdit className="size-5" /></div><div><p className="font-display text-lg font-semibold text-petrol">Editor Editorial V2</p><p className="text-xs text-muted-foreground">Modo operacional · {EDITORIAL_OPERATIONAL_WRITE_MODE}</p></div></div><Link to="/editorial" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4" />Painel editorial</Link></div></header>
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <section className="rounded-3xl border bg-card/60 p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div><h1 className="font-display text-3xl font-bold text-petrol">Escrita editorial ativa</h1><p className="mt-3 max-w-3xl text-muted-foreground">Rascunhos, revisões, agendamentos e publicação usam exclusivamente o Supabase do Blog. RLS, gatilhos, concorrência otimista e regra de quatro-olhos continuam como autoridade.</p></div><div className="rounded-2xl border bg-background p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" />Persistência ativa</div><div className="mt-2 text-muted-foreground">Papel atual: {editorialRoleLabel(member.role)}</div></div></div></section>

      <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={createNewDraft} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Novo rascunho</button><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={input()}><option value="">Novo / selecione um artigo</option>{options.map((o) => <option key={o.id} value={o.id}>{o.title} · {blogPostStatusLabel(o.status)} · {revisionLabel(o.revisionNumber)}</option>)}</select></div>
      {error && <div className="mt-5 rounded-2xl border p-4 text-sm">{error}</div>}
      {success && <div className="mt-5 rounded-2xl border p-4 text-sm">{success}</div>}

      {form && <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border bg-card/60 p-6"><div className="grid gap-5 md:grid-cols-2">
          <Field label="Título"><input value={form.title} disabled={!editable} onChange={(e) => patch(form, setForm, "title", e.target.value)} className={input()} /></Field>
          <Field label="Slug"><input value={form.slug} disabled={!editable} onChange={(e) => patch(form, setForm, "slug", e.target.value)} className={input()} /></Field>
          <Field label="Categoria"><select value={form.category} disabled={!editable} onChange={(e) => patch(form, setForm, "category", e.target.value)} className={input()}>{catalog?.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></Field>
          <Field label="Autor"><select value={form.author} disabled={!editable} onChange={(e) => patch(form, setForm, "author", e.target.value)} className={input()}>{catalog?.authors.map((item) => <option key={item.id} value={item.displayName}>{item.displayName}</option>)}</select></Field>
          <div className="md:col-span-2"><Field label="Resumo"><textarea value={form.excerpt} disabled={!editable} onChange={(e) => patch(form, setForm, "excerpt", e.target.value)} className={`${input()} min-h-24 py-3`} /></Field></div>
          <div className="md:col-span-2"><Field label="Conteúdo"><textarea value={contentText} disabled={!editable} onChange={(e) => setContentText(e.target.value)} className={`${input()} min-h-64 py-3`} /><p className="mt-2 text-xs leading-5 text-muted-foreground">Digite normalmente. O texto só é convertido para a estrutura editorial no momento de salvar ou executar uma ação. Links: [texto](/rota-interna) ou [texto](https://exemplo.com).</p></Field></div>
          <Field label="Marcadores (vírgula, ponto e vírgula ou Enter)"><input value={tagText} disabled={!editable} onChange={(e) => setTagText(e.target.value)} className={input()} placeholder="Ex.: Fluxo de caixa, Gestão, ERP" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Proprietário/editor pode criar marcadores novos automaticamente ao salvar.</p></Field>
          <Field label="Tempo de leitura"><input type="number" min={1} value={form.readingTimeMinutes} disabled={!editable} onChange={(e) => patch(form, setForm, "readingTimeMinutes", Number(e.target.value))} className={input()} /></Field>
          <Field label="Título SEO"><input value={form.metaTitle} disabled={!editable} onChange={(e) => patch(form, setForm, "metaTitle", e.target.value)} className={input()} /></Field>
          <Field label="Descrição SEO"><input value={form.metaDescription} disabled={!editable} onChange={(e) => patch(form, setForm, "metaDescription", e.target.value)} className={input()} /></Field>
          <Field label="Palavra-chave"><input value={form.focusKeyword} disabled={!editable} onChange={(e) => patch(form, setForm, "focusKeyword", e.target.value)} className={input()} /></Field>
          <div className="md:col-span-2 rounded-2xl border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Controles avançados de indexação</p><p className="mt-2 text-sm text-muted-foreground">Contrato R3 preparado para persistência por artigo.</p></div><span className="rounded-full border px-3 py-1 text-xs font-semibold">{BLOG_SEO_PERSISTENCE_READY ? "Persistência disponível" : "Aguardando migration no Blog Lab"}</span></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SeoToggle label="Indexar este artigo" checked={form.allowIndexing} disabled={!seoControlsEnabled} onChange={(checked) => setForm({ ...form, allowIndexing: checked, includeInSitemap: checked ? form.includeInSitemap : false })} />
              <SeoToggle label="Permitir seguir links" checked={form.allowFollowing} disabled={!seoControlsEnabled} onChange={(checked) => patch(form, setForm, "allowFollowing", checked)} />
              <SeoToggle label="Incluir no sitemap" checked={form.includeInSitemap} disabled={!seoControlsEnabled || !form.allowIndexing} onChange={(checked) => patch(form, setForm, "includeInSitemap", checked)} />
            </div>
            {!BLOG_SEO_PERSISTENCE_READY && <p className="mt-4 text-xs leading-5 text-muted-foreground">Os controles permanecem bloqueados nesta fase repository-only para evitar valores que o banco atual ainda não persiste. Os defaults históricos continuam index, follow e sitemap ativos.</p>}
          </div>
          <div className="md:col-span-2 rounded-2xl border bg-background/70 p-4">
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="aspect-[16/9] overflow-hidden rounded-xl border bg-muted/40">
                {imagePreviewUrl ? <img src={imagePreviewUrl} alt={form.featuredImageAlt || "Pré-visualização da imagem destacada"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">Nenhuma imagem destacada selecionada</div>}
              </div>
              <div className="space-y-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Imagem destacada / SEO</p><p className="mt-2 text-sm leading-6 text-muted-foreground">JPEG, PNG, WebP ou AVIF · máximo 5 MB. Em artigo novo, você já pode escolher o arquivo; ele será enviado automaticamente no primeiro salvamento.</p></div>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!editable || mediaBusy} onChange={(e) => void uploadImage(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:bg-background file:px-3 file:py-2 file:font-semibold disabled:opacity-60" />
                <Field label="Texto alternativo da imagem"><input value={form.featuredImageAlt} disabled={!editable} onChange={(e) => patch(form, setForm, "featuredImageAlt", e.target.value)} className={input()} placeholder="Descreva objetivamente o conteúdo da imagem" /></Field>
                {pendingImage && <div className="flex flex-wrap items-center gap-3"><p className="max-w-full truncate text-xs text-muted-foreground" title={pendingImage.name}>Arquivo selecionado: {pendingImage.name}</p><button type="button" disabled={mediaBusy} onClick={() => setPendingImage(null)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60">Cancelar arquivo selecionado</button></div>}
                {form.featuredImagePath && <div className="flex flex-wrap items-center gap-3"><p className="max-w-full truncate text-xs text-muted-foreground" title={form.featuredImagePath}>{form.featuredImagePath}</p><button type="button" disabled={!editable || mediaBusy} onClick={() => setForm({ ...form, featuredImagePath: "" })} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60">Remover referência</button></div>}
              </div>
            </div>
          </div>
          <Field label="Agendamento"><input type="datetime-local" value={form.scheduledAt ? localDateTimeValue(form.scheduledAt) : ""} disabled={!editable} onChange={(e) => patch(form, setForm, "scheduledAt", e.target.value)} className={input()} /></Field>
          <Field label="Estado / revisão"><div className="flex h-11 items-center rounded-xl border bg-muted/40 px-3 text-sm">{blogPostStatusLabel(form.status)} · {revisionLabel(form.revisionNumber)}</div></Field>
        </div></section>

        <aside className="space-y-6"><section className="rounded-3xl border bg-card/60 p-5"><h2 className="font-display text-xl font-semibold">Fluxo editorial real</h2><p className="mt-2 text-sm text-muted-foreground">Cada ação abaixo persiste no Supabase do Blog e continua sujeita às regras do banco.</p><div className="mt-4 space-y-2">{commands.map((command) => <button key={command} type="button" disabled={busy || mediaBusy} onClick={() => execute(command)} className="w-full rounded-xl border bg-background px-4 py-3 text-left text-sm font-semibold disabled:opacity-60">{busy ? "Processando…" : LABELS[command]}</button>)}</div></section><section className="rounded-3xl border bg-card/60 p-5"><h2 className="font-display text-xl font-semibold">Notas de revisão</h2><textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className={`${input()} mt-3 min-h-24 py-3`} placeholder="Opcional para aprovação ou solicitação de ajustes" /><p className="mt-3 text-xs leading-5 text-muted-foreground">A regra de quatro-olhos permanece obrigatória: quem criou a revisão não pode aprová-la.</p></section></aside>
      </div>}
    </main>
  </div>;
}

function localDateTimeValue(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return value; const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function patch<K extends keyof EditorialEditorForm>(form: EditorialEditorForm | null, setter: React.Dispatch<React.SetStateAction<EditorialEditorForm | null>>, key: K, value: EditorialEditorForm[K]) { if (form) setter({ ...form, [key]: value }); }
function input() { return "h-11 min-w-56 rounded-xl border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>{children}</label>; }
function SeoToggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3 text-sm font-medium"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4" /><span>{label}</span></label>; }
function Message({ title, description = "Conferindo sessão exclusiva do Blog e vínculo editorial." }: { title: string; description?: string }) { return <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center"><div className="max-w-xl rounded-3xl border bg-card/60 p-9"><h1 className="font-display text-3xl font-bold text-petrol">{title}</h1><p className="mt-3 text-muted-foreground">{description}</p><Link to="/editorial" className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline">Ir para o painel editorial</Link></div></main>; }
