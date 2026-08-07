import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  Mail, 
  Shield, 
  UserPlus, 
  CheckCircle2, 
  Clock,
  MoreVertical,
  Trash2
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { 
  listCompanyMembers, 
  listCompanyInvitations 
} from "@/lib/multiempresa.functions";
import { createInternalInvitation } from "@/lib/multiempresa-admin.functions";
import { toast } from "sonner";
import { useState } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/minha-empresa")({
  head: () => ({ meta: [{ title: "Gestão da Empresa — Vejamais" }] }),
  component: MinhaEmpresaPage,
});

function MinhaEmpresaPage() {
  const { user } = useAuth();
  const { 
    empresa, 
    companies, 
    isLoading: loadingMultiempresa, 
    isError: contextError,
    error: contextErrorInfo,
    refetch: refetchMultiempresa
  } = useMultiempresa();
  const [inviteForm, setInviteForm] = useState({ email: "", role: "vendedor" as any });
  const isAdmin = empresa?.user_role === 'admin';

  const fetchMembers = useServerFn(listCompanyMembers);
  const fetchInvitations = useServerFn(listCompanyInvitations);

  // State isolado para membros
  const { 
    data: members = [], 
    isLoading: loadingMembers, 
    error: membersError,
    refetch: refetchMembers
  } = useQuery({
    queryKey: ["company-members", empresa?.id],
    enabled: !!empresa?.id && isAdmin,
    queryFn: () => fetchMembers({ data: empresa!.id })
  });

  // State isolado para convites
  const { 
    data: invitations = [], 
    isLoading: loadingInvites,
    isError: hasInvitesError,
    error: invitesError,
    refetch: refetchInvites
  } = useQuery({
    queryKey: ["company-invitations", empresa?.id],
    enabled: !!empresa?.id && isAdmin,
    queryFn: () => fetchInvitations({ data: empresa!.id })
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.info("A funcionalidade de convite está em modo preview e não criará dados reais no banco de dados.");
    setInviteForm({ email: "", role: "vendedor" });
  };

  // ERRO CRÍTICO: Contexto primário falhou
  if (contextError) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-destructive font-medium">Erro ao carregar contexto de empresas</div>
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-md max-w-md mx-auto overflow-hidden">
          <p className="font-mono">Code: {contextErrorInfo?.name || "UNKNOWN"}</p>
          <p className="mt-1">{contextErrorInfo?.message || "Ocorreu um erro ao resolver o acesso às suas empresas."}</p>
        </div>
        <Button onClick={() => refetchMultiempresa()}>Tentar novamente</Button>
      </div>
    );
  }


  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader 
        title="Minha Empresa" 
        subtitle="Gestão de unidades, equipe e permissões" 
      />

      {/* Empresa Ativa e Unidades */}
      <section className="space-y-4">
        <h2 className="text-xl font-display flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          Empresas e Unidades
        </h2>
        
        {loadingMultiempresa ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1].map(i => (
              <Card key={i} className="animate-pulse shadow-soft h-40 bg-muted/20" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <Card className="shadow-soft border-dashed border-2">
            <CardContent className="p-8 text-center flex flex-col items-center">
              <Building2 className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Nenhuma empresa encontrada.</p>
              <p className="text-xs text-muted-foreground mt-1">Verifique seu vínculo de acesso com o administrador.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((c) => (
              <Card key={c.id} className={c.id === empresa?.id ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "shadow-soft"}>
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="size-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{c.nome}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.tipo || 'Unidade'}</p>
                      </div>
                    </div>
                    {c.id === empresa?.id && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px]">Ativa</Badge>
                    )}
                  </div>
                  
                  <div className="mt-auto pt-4 border-t flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Seu Papel</span>
                      <span className="font-medium flex items-center gap-1 capitalize">
                        <Shield className="size-3 text-primary" /> {c.user_role}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Vínculo</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase border-green-500/30 text-green-600 bg-green-50/50">Ativo</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Membros e Equipe */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-display flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Membros e Equipe
          </h2>
          <Card className="shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-4 font-semibold">Membro</th>
                    <th className="text-left p-4 font-semibold">Papel</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-right p-4 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingMembers ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground animate-pulse">Carregando equipe...</td>
                    </tr>
                  ) : membersError ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center space-y-3">
                        <p className="text-destructive text-xs font-medium">Erro ao carregar membros.</p>
                        <Button variant="outline" size="sm" onClick={() => refetchMembers()}>Tentar novamente</Button>
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground italic">
                        Nenhum membro encontrado nesta empresa.
                      </td>
                    </tr>
                  ) : (
                    members.map((m) => (
                      <tr key={m.user_id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground">
                              {m.user_id === user?.id ? "EU" : "MB"}
                            </div>
                            <div>
                              <div className="font-medium text-xs truncate max-w-[150px]">{m.user_id === user?.id ? "Você" : m.user_id}</div>
                              {m.is_primary && <div className="text-[10px] text-primary">Administrador principal</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize text-[10px] font-normal border-primary/20 bg-primary/5">
                            {m.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-green-600">
                            <CheckCircle2 className="size-3" />
                            <span className="text-[11px] font-medium">Ativo</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {isAdmin && m.user_id !== user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Alterar papel</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Remover acesso</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Convites */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            <h2 className="text-xl font-display">Convites</h2>
          </div>
          
          <Card className="shadow-soft">
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                Convidar Membro
                {!isAdmin && <Shield className="size-3 text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">E-mail do convidado</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="exemplo@email.com" 
                    value={inviteForm.email}
                    onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                    disabled={!isAdmin}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs">Papel</Label>
                  <select 
                    id="role"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={inviteForm.role}
                    onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                    disabled={!isAdmin}
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9"
                  disabled={!isAdmin || !inviteForm.email}
                >
                  <UserPlus className="size-4 mr-2" /> Enviar Convite
                </Button>
                {!isAdmin && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Apenas administradores podem enviar convites.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="shadow-soft">
              <CardHeader className="pb-3 border-b mb-0">
                <CardTitle className="text-sm font-semibold">Pendentes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingInvites ? (
                  <div className="p-8 text-center text-muted-foreground animate-pulse text-xs">Carregando convites...</div>
                ) : hasInvitesError ? (
                  <div className="p-6 text-center space-y-2">
                    <p className="text-destructive text-[10px] font-medium">Erro na listagem de convites.</p>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => refetchInvites()}>Tentar</Button>
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Clock className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground italic">Nenhum convite pendente</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="p-3 flex items-center justify-between">
                        <div className="overflow-hidden mr-2">
                          <p className="text-xs font-medium truncate">{inv.email}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{inv.role}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive"><Trash2 className="size-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}