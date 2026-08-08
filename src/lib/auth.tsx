import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "vendedor" | "financeiro";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  can: (perm: Permission) => boolean;
  signOut: () => Promise<void>;
};

export type Permission =
  | "view:dashboard"
  | "view:bi"
  | "view:clients"
  | "view:suppliers"
  | "view:products"
  | "view:sales"
  | "view:payables"
  | "view:receivables"
  | "view:cashflow"
  | "view:finance"
  | "view:reports"
  | "view:settings"
  | "view:goals"
  | "view:commissions";

export const PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: [
    "view:dashboard","view:bi","view:clients","view:suppliers","view:products",
    "view:sales","view:payables","view:receivables","view:cashflow","view:finance",
    "view:reports","view:settings","view:goals","view:commissions",
  ],
  vendedor: ["view:dashboard","view:clients","view:products","view:sales"],
  financeiro: [
    "view:dashboard","view:payables","view:receivables","view:cashflow",
    "view:finance","view:reports","view:bi",
  ],
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, role: null,
  can: () => false, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setRole(null); return; }
    supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", uid)
      .then(({ data }) => {
        const roles = ((data ?? []) as any[]).map((r) => r.role as AppRole);
        if (roles.includes("admin")) setRole("admin");
        else if (roles.includes("financeiro")) setRole("financeiro");
        else if (roles.includes("vendedor")) setRole("vendedor");
        else setRole(null);
      });
  }, [session?.user?.id]);

  const can = (perm: Permission) => (role ? PERMISSIONS[role].includes(perm) : false);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        role,
        can,
        signOut: async () => { await supabase.auth.signOut(); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
