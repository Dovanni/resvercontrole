import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Wallet, Sparkles, LogOut, Users, Truck, Receipt, HandCoins, LineChart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
  { to: "/contas-pagar", label: "Contas a pagar", icon: Receipt },
  { to: "/contas-receber", label: "Contas a receber", icon: HandCoins },
  { to: "/fluxo-caixa", label: "Fluxo de caixa", icon: LineChart },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-6 py-6 flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl">Rosé</span>
        </div>
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
          <div className="text-xs text-muted-foreground mb-2 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="w-full justify-start">
            <LogOut className="size-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b px-4 py-3 flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl">Rosé</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
        <nav className="md:hidden border-t bg-sidebar grid grid-cols-7 text-[10px]">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  "flex flex-col items-center py-2 gap-1",
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
