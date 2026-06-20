import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Pencil, Trash2, Plus, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

export type Categoria = { id: string; nome: string; padrao: boolean };

export function useCategoriasContasPagar() {
  return useQuery({
    queryKey: ["categorias-contas-pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_contas_pagar" as any)
        .select("id,nome,padrao")
        .order("padrao", { ascending: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Categoria[];
    },
  });
}

export function CategoriasManagerInline() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: cats } = useCategoriasContasPagar();
  const [novo, setNovo] = useState("");
  const [busca, setBusca] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");

  const existingLower = useMemo(
    () => new Set((cats ?? []).map((c) => c.nome.trim().toLowerCase())),
    [cats],
  );

  const create = useMutation({
    mutationFn: async (nomeRaw: string) => {
      const nome = nomeRaw.trim();
      if (nome.length < 2) throw new Error("Nome deve ter no mínimo 2 caracteres");
      if (existingLower.has(nome.toLowerCase())) throw new Error("Esta categoria já existe");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("categorias_contas_pagar" as any)
        .insert({ user_id: user.id, nome, padrao: false });
      if (error) {
        console.error("Erro ao inserir categoria:", error);
        if (error.code === "23505") throw new Error("Esta categoria já existe");
        throw new Error(error.message);
      }
    },
    onSuccess: () => { setNovo(""); toast.success("Categoria criada"); qc.invalidateQueries({ queryKey: ["categorias-contas-pagar"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const n = nome.trim();
      if (n.length < 2) throw new Error("Nome deve ter no mínimo 2 caracteres");
      const dup = (cats ?? []).find((c) => c.id !== id && c.nome.trim().toLowerCase() === n.toLowerCase());
      if (dup) throw new Error("Já existe uma categoria com esse nome");
      const { error } = await supabase.from("categorias_contas_pagar" as any)
        .update({ nome: n }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setEditId(null); toast.success("Renomeada"); qc.invalidateQueries({ queryKey: ["categorias-contas-pagar"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (cat: Categoria) => {
      const { count, error: cErr } = await supabase.from("payables")
        .select("id", { count: "exact", head: true }).eq("category", cat.nome);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) throw new Error(`Categoria em uso por ${count} conta(s)`);
      const { error } = await supabase.from("categorias_contas_pagar" as any).delete().eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["categorias-contas-pagar"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtro = busca.trim().toLowerCase();
  const all = cats ?? [];
  const padrao = all.filter((c) => c.padrao && (!filtro || c.nome.toLowerCase().includes(filtro)));
  const custom = all.filter((c) => !c.padrao && (!filtro || c.nome.toLowerCase().includes(filtro)));

  return (
    <div className="w-full space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (novo.trim().length >= 2) create.mutate(novo); }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          placeholder="Nova categoria (mín. 2 caracteres)"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={novo.trim().length < 2 || create.isPending}>
          <Plus className="size-4 mr-1" /> Adicionar
        </Button>
      </form>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar categoria…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lock className="size-3.5" /> Padrão (não editáveis)
        </div>
        <div className="border rounded-lg divide-y bg-card">
          {padrao.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2">
              <Lock className="size-3 text-muted-foreground" />
              <span className="flex-1 capitalize">{c.nome}</span>
            </div>
          ))}
          {padrao.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhuma.</div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Pencil className="size-3.5" /> Personalizadas (editáveis)
        </div>
        <div className="border rounded-lg divide-y bg-card">
          {custom.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2">
              {editId === c.id ? (
                <>
                  <Input
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename.mutate({ id: c.id, nome: editNome });
                      if (e.key === "Escape") setEditId(null);
                    }}
                  />
                  <Button size="icon" variant="ghost" onClick={() => rename.mutate({ id: c.id, nome: editNome })} disabled={editNome.trim().length < 2}>
                    <Check className="size-4 text-success" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 capitalize">{c.nome}</span>
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(c.id); setEditNome(c.nome); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (await confirm({ title: "Excluir categoria?", description: `"${c.nome}" será removida.` })) remove.mutate(c);
                  }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {custom.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhuma categoria personalizada.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export function CategoriasManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Categorias de Despesas</DialogTitle></DialogHeader>
        <CategoriasManagerInline />
      </DialogContent>
    </Dialog>
  );
}
