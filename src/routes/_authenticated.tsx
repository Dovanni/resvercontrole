import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Local session check (no network round-trip). Keeps route transitions
    // instant on mobile; the fail-safe useEffect below still redirects when
    // the session becomes null at runtime.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();

  // Apply company theme on login
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("company_settings" as any).select("theme").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const theme = (data as any)?.theme ?? "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
    });
  }, [user?.id]);

  // Fail-safe: once auth is resolved and there is no session (post-logout or
  // expired token), navigate to /auth instead of leaving the user stuck on
  // "Carregando…".
  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <ConfirmProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ConfirmProvider>
  );
}
