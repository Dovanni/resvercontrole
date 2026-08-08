import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // Se houver parâmetros, decide o destino
    if ((token_hash || code) && type === "recovery") {
      if (location.pathname === "/auth/callback/recovery") return;
      throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
    }

    if (code || type === "signup" || type === "invite") {
      if (location.pathname === "/auth/callback") return;
      throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
    }

    // Se cair aqui e estiver no path /auth, manda para login
    if (location.pathname === "/auth" || location.pathname === "/auth/") {
      throw redirect({ to: "/login", replace: true });
    }
  },
  component: () => <Outlet />,
});
