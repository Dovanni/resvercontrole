import { Link, useRouterState, useRouter, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Wallet, LogOut, Users, Truck, Receipt, HandCoins, LineChart, BarChart3, BarChartBig, FileText, Settings, CalendarDays, TrendingUp, Landmark, CreditCard, ShoppingCart, Scale, Menu, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, type Permission, PERMISSIONS, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications";
import { VejamaisMark } from "@/components/vejamais-logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CompanySelector } from "./company-selector";
import { useMultiempresa } from "@/hooks/use-multiempresa";
import { TrialBanner } from "./trial-banner";

const ALL_NAV: { to: string; label: string; icon: any; perm: Permission }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "view:dashboard" },
  { to: "/bi", label: "BI", icon: BarChart3, perm: "view:bi" },
  { to: "/curva-abc", label: "Curva ABC", icon: BarChartBig, perm: "view:bi" },
  { to: "/clientes", label: "Clientes", icon: Users, perm: "view:clients" },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, perm: "view:suppliers" },
  { to: "/produtos", label: "Produtos", icon: Package, perm: "view:products" },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag, perm: "view:sales" },
  { to: "/controle-vendas", label: "Controle de vendas", icon: TrendingUp, perm: "view:sales" },
  { to: "/compras", label: "Compras", icon: ShoppingCart, perm: "view:payables" },
  { to: "/contas-pagar", label: "Contas a pagar", icon: Receipt, perm: "view:payables" },
  { to: "/despesas-anuais", label: "Despesas anuais", icon: CalendarDays, perm: "view:payables" },
  { to: "/contas-receber", label: "Contas a receber", icon: HandCoins, perm: "view:receivables" },
  { to: "/fluxo-caixa", label: "Fluxo de caixa", icon: LineChart, perm: "view:cashflow" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, perm: "view:finance" },
  { to: "/balancete", label: "Balancete", icon: Scale, perm: "view:finance" },
  { to: "/contas-bancarias", label: "Contas bancárias", icon: Landmark, perm: "view:finance" },
  { to: "/cartoes-credito", label: "Cartões de crédito", icon: CreditCard, perm: "view:finance" },
  { to: "/dre", label: "DRE", icon: Scale, perm: "view:reports" },
  { to: "/relatorios", label: "Relatórios", icon: FileText, perm: "view:reports" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, perm: "view:settings" },
  { to: "/minha-empresa", label: "Minha Empresa", icon: Building2, perm: "view:dashboard" },
];

const ROLE_LABEL: Record<string, string> = { admin: "Admin", vendedor: "Vendedor", financeiro: "Financeiro" };

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user, role: legacyRole, can } = useAuth();
  const { isEnabled, empresa } = useMultiempresa();
  
  // A autoridade primária de role agora é o membership da empresa ativa
  const role = (empresa?.user_role || legacyRole) as AppRole | null;

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = ALL_NAV.filter((n) => role ? PERMISSIONS[role].includes(n.perm) : false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fecha automaticamente o menu mobile ao concluir uma navegação.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      try {
        await signOut();
      } catch (err) {
        console.error("signOut error", err);
        toast.error("Não foi possível encerrar a sessão. Tente novamente.");
      }
      try {
        await router.invalidate();
      } catch {
        /* noop */
      }
      navigate({ to: "/auth", replace: true });
    } finally {
      setSigningOut(false);
    }
  };


  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-6 py-6 flex items-center gap-2.5">
          <VejamaisMark size={36} className="rounded-xl shadow-glow" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-2xl">Vejamais</span>
            <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Gestão Comercial e Financeira</span>
          </div>
        </div>
        
        {isEnabled && (
          <div className="px-3 mb-4">
            <CompanySelector className="w-full" />
          </div>
        )}

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                ].join(" ")}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground mb-0.5 truncate">{user?.email}</div>
          {role && <div className="text-[10px] text-primary font-medium mb-2 uppercase tracking-wider">{ROLE_LABEL[role]}</div>}
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut} className="w-full justify-start">
            <LogOut className="size-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b px-4 py-3 flex items-center justify-between bg-sidebar md:bg-background md:border-transparent">
          <div className="flex items-center gap-2 md:hidden">
            <VejamaisMark size={32} className="rounded-lg" />
            <span className="font-display text-xl">Vejamais</span>
          </div>
          <div className="md:ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <CompanySelector />
            </div>
            <NotificationsBell />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  aria-label="Abrir menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0 flex flex-col">
                <SheetHeader className="px-4 py-4 border-b text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <VejamaisMark size={28} className="rounded-lg" />
                    <span className="font-display text-lg">Vejamais</span>
                  </SheetTitle>
                  {user?.email && (
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  )}
                  {role && (
                    <div className="text-[10px] text-primary font-medium uppercase tracking-wider">
                      {ROLE_LABEL[role]}
                    </div>
                  )}
                </SheetHeader>
                
                {isEnabled && (
                  <div className="p-4 border-b">
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Empresa Ativa</div>
                    <CompanySelector className="w-full" />
                  </div>
                )}

                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  {nav.map((n) => {
                    const active = pathname === n.to || pathname.startsWith(n.to + "/");
                    return (
                      <Link
                        key={n.to}
                        to={n.to}
                        onClick={() => {
                          setMobileOpen(false);
                        }}
                        className={[
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                        ].join(" ")}
                      >
                        <n.icon className="size-4" />
                        {n.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="p-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full justify-start"
                  >
                    <LogOut className="size-4 mr-2" /> Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
        <nav className="md:hidden border-t bg-sidebar flex overflow-x-auto text-[10px]">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  "flex flex-col items-center py-2 px-3 gap-1 shrink-0 min-w-16",
                  active ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                <n.icon className="size-4" />
                <span className="truncate max-w-full px-0.5">{n.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-display text-3xl text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
