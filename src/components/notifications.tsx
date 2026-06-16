import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { useAuth } from "@/lib/auth";

type Notif = { id: string; kind: "stock" | "due" | "old-order"; title: string; desc: string; href: string };

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const [lowStock, dueToday, oldOrders] = await Promise.all([
        supabase.from("products").select("id,name,stock,min_stock").order("name"),
        supabase.from("payables").select("id,description,amount,due_date").eq("due_date", today).neq("status", "pago").neq("status", "cancelado"),
        supabase.from("sales").select("id,customer_name,total,sold_at,customers(name)").in("status", ["orcamento", "confirmado", "separacao"]).lt("sold_at", threeDaysAgo).order("sold_at", { ascending: true }),
      ]);

      const items: Notif[] = [];
      for (const p of (lowStock.data ?? []).filter((p: any) => Number(p.stock) <= Number(p.min_stock))) {
        items.push({ id: `stock-${p.id}`, kind: "stock", title: p.name, desc: `Estoque ${p.stock} (mín ${p.min_stock})`, href: "/produtos" });
      }
      for (const d of dueToday.data ?? []) {
        items.push({ id: `due-${d.id}`, kind: "due", title: d.description, desc: `Vence hoje · ${brl(Number(d.amount))}`, href: "/contas-pagar" });
      }
      for (const s of oldOrders.data ?? []) {
        const name = (s as any).customers?.name ?? s.customer_name ?? "Balcão";
        const days = Math.floor((Date.now() - new Date(s.sold_at).getTime()) / 86_400_000);
        items.push({ id: `old-${s.id}`, kind: "old-order", title: name, desc: `Pedido há ${days} dias · ${brl(Number(s.total))}`, href: "/vendas" });
      }
      return items;
    },
  });

  const count = data?.length ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center px-1">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b font-display">Notificações</div>
        <div className="max-h-96 overflow-y-auto">
          {count === 0 && <div className="p-6 text-sm text-center text-muted-foreground">Tudo em ordem ✨</div>}
          {data?.map((n) => {
            const Icon = n.kind === "stock" ? AlertTriangle : n.kind === "due" ? Calendar : Clock;
            const tone = n.kind === "stock" ? "text-destructive" : n.kind === "due" ? "text-warning" : "text-primary";
            return (
              <Link
                key={n.id}
                to={n.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-accent border-b last:border-b-0"
              >
                <Icon className={`size-4 mt-0.5 ${tone}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { dateBR };
