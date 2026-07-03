import { createFileRoute, Navigate, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Building2, Moon, Sun, Trash2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { isValidCNPJ, maskCNPJ } from "@/lib/validators";
import { useConfirm } from "@/components/confirm-dialog";
import { resetDemoData } from "@/lib/api/reset-demo.functions";


export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Rosé" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const location = useLocation();
  const { user, can, role } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const resetFn = useServerFn(resetDemoData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ company_name: "", cnpj: "", logo_url: "", theme: "light" as "light" | "dark" });

  if (!can("view:settings") && location.pathname === "/configuracoes") return <Navigate to="/dashboard" />;

  const { data, isLoading } = useQuery({
    queryKey: ["company-settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings" as any).select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        company_name: data.company_name ?? "",
        cnpj: data.cnpj ?? "",
        logo_url: data.logo_url ?? "",
        theme: data.theme ?? "light",
      });
      try {
        localStorage.setItem("rose:brand", JSON.stringify({ name: data.company_name ?? "", logo: data.logo_url ?? "" }));
      } catch {}
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (form.cnpj && !isValidCNPJ(form.cnpj)) throw new Error("CNPJ inválido");
      const { error } = await supabase.from("company_settings" as any).upsert({
        user_id: user!.id,
        company_name: form.company_name || null,
        cnpj: form.cnpj || null,
        logo_url: form.logo_url || null,
        theme: form.theme,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      document.documentElement.classList.toggle("dark", form.theme === "dark");
      try {
        localStorage.setItem("rose:brand", JSON.stringify({ name: form.company_name, logo: form.logo_url }));
      } catch {}
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      await resetFn();
    },
    onSuccess: () => {
      toast.success("Dados de demonstração apagados");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao resetar dados"),
  });

  const handleReset = async () => {
    const ok = await confirm({
      title: "Resetar dados de demonstração?",
      description:
        "Isso vai apagar TODOS os clientes, fornecedores, produtos, pedidos, contas a pagar/receber e movimentações financeiras. As configurações da empresa e o usuário admin serão mantidos. Esta ação não pode ser desfeita.",
      confirmText: "Sim, apagar tudo",
      destructive: true,
    });
    if (ok) reset.mutate();
  };

  if (location.pathname !== "/configuracoes") return <Outlet />;

  const uploadLogo = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user!.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: signed } = await supabase.storage.from("company-logos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signed?.signedUrl) setForm((f) => ({ ...f, logo_url: signed.signedUrl }));
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Configurações" subtitle="Identidade e preferências da empresa" />

      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link to="/importar"><Upload className="size-4 mr-1" /> Importar planilha (Excel)</Link>
        </Button>
      </div>


      <Card className="shadow-soft">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="size-20 rounded-2xl bg-muted overflow-hidden flex items-center justify-center">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="object-cover w-full h-full" />
              ) : (
                <Building2 className="size-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4 mr-1" /> Enviar logo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
              <p className="text-xs text-muted-foreground mt-2">PNG ou JPG, recomendado quadrado.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da empresa</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
            {form.cnpj && !isValidCNPJ(form.cnpj) && (
              <p className="text-xs text-destructive">CNPJ inválido</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tema</Label>
            <Select value={form.theme} onValueChange={(v: any) => setForm({ ...form, theme: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="size-4" /> Claro</div></SelectItem>
                <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="size-4" /> Escuro</div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full bg-gradient-primary text-primary-foreground">
            {save.isPending ? "Salvando…" : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>

      <RoutingRulesSection />

      <Card className="shadow-soft mt-6">
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg">Categorias de despesas</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie as categorias usadas em Contas a pagar.
            </p>
          </div>
          <Button asChild variant="link" className="text-primary">
            <Link to="/configuracoes/categorias">Gerenciar categorias →</Link>
          </Button>
        </CardContent>
      </Card>


      {role === "admin" && (
        <Card className="shadow-soft mt-6 border-destructive/30">
          <CardContent className="p-6 space-y-3">
            <div>
              <h3 className="font-display text-lg">Zona de risco</h3>
              <p className="text-sm text-muted-foreground">
                Apaga clientes, fornecedores, produtos, pedidos, contas e movimentações.
                Mantém apenas o usuário admin e as configurações da empresa.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReset}
              disabled={reset.isPending}
            >
              <Trash2 className="size-4 mr-1" />
              {reset.isPending ? "Apagando…" : "Resetar dados de demonstração"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = {
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  cartao: "Cartão (parcelado)",
  mercado_livre: "Venda Mercado Livre",
  pix: "PIX",
  pix_prazo: "PIX a prazo",
  deposito: "Depósito bancário",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
  crediario: "Crediário",
  prazo: "A prazo",
};

function RoutingRulesSection() {
  const qc = useQueryClient();
  const { data: rules } = useQuery({
    queryKey: ["routing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_routing_rules" as any)
        .select("id,payment_method,bank_account_id,fixo")
        .order("payment_method");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; payment_method: string; bank_account_id: string | null; fixo: boolean }[];
    },
  });
  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts" as any).select("id,name,bank,color").eq("status", "ativa").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; bank: string; color: string }[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, bank_account_id }: { id: string; bank_account_id: string | null }) => {
      const { error } = await supabase.from("payment_routing_rules" as any).update({ bank_account_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regra atualizada"); qc.invalidateQueries({ queryKey: ["routing-rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-soft mt-6">
      <CardContent className="p-6 space-y-3">
        <div>
          <h3 className="font-display text-lg">Regras de recebimento</h3>
          <p className="text-sm text-muted-foreground">
            Vincule cada forma de pagamento a uma conta bancária. Regras fixas (cartões e ML) são aplicadas automaticamente.
          </p>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Forma de pagamento</th>
                <th className="text-left px-3 py-2">Conta vinculada</th>
                <th className="text-left px-3 py-2 w-24">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{METHOD_LABELS[r.payment_method] ?? r.payment_method}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={r.bank_account_id ?? "__none__"}
                      onValueChange={(v) => update.mutate({ id: r.id, bank_account_id: v === "__none__" ? null : v })}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="Escolher no momento" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Escolher no momento</SelectItem>
                        {(accounts ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="inline-flex items-center gap-2">
                              <span className="size-2 rounded-full" style={{ background: a.color }} />{a.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${r.fixo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {r.fixo ? "Fixo" : "Livre"}
                    </span>
                  </td>
                </tr>
              ))}
              {(rules ?? []).length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground text-sm">Nenhuma regra cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
