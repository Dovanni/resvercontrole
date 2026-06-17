import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Pencil, Trash2, Plus, Check, X } from "lucide-react";
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");

  const create = useMutation({
    mutationFn: async (nome: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("categorias_contas_pagar" as any)
        .insert({ user_id: user.id, nome: nome.trim(), padrao: false });
      if (error) throw error;
    },
    onSuccess: () => { setNovo(""); toast.success("Categoria criada"); qc.invalidateQueries({ queryKey: ["categorias-contas-pagar"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("categorias_contas_pagar" as any)
        .update({ nome: nome.trim() }).eq("id", id);
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

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); if (novo.trim()) create.mutate(novo); }}
        className="flex gap-2"
      >
        <Input placeholder="Nova categoria" value={novo} onChange={(e) => setNovo(e.target.value)} />
        <Button type="submit" disabled={!novo.trim() || create.isPending}>
          <Plus className="size-4 mr-1" /> Adicionar
        </Button>
      </form>

      <div className="border rounded-lg divide-y">
        {(cats ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-2">
            {editId === c.id ? (
              <>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-8" />
                <Button size="icon" variant="ghost" onClick={() => rename.mutate({ id: c.id, nome: editNome })} disabled={!editNome.trim()}>
                  <Check className="size-4 text-success" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                  <X className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 capitalize flex items-center gap-2">
                  {c.padrao && <Lock className="size-3 text-muted-foreground" />}
                  {c.nome}
                </span>
                {!c.padrao && (
                  <>
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
              </>
            )}
          </div>
        ))}
        {(cats ?? []).length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma categoria.</div>
        )}
      </div>
    </div>
  );
}

export function CategoriasManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">Gerenciar categorias</DialogTitle></DialogHeader>
        <CategoriasManagerInline />
      </DialogContent>
    </Dialog>
  );
}
