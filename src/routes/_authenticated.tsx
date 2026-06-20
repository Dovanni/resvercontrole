import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, user } = useAuth();

  // Apply company theme on login
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("company_settings" as any).select("theme").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const theme = (data as any)?.theme ?? "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
    });
  }, [user?.id]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  return (
    <ConfirmProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ConfirmProvider>
  );
}

