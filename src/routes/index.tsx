import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ location, search }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // Se for rota de auth legada ou parâmetro de auth na raiz
    if (location.pathname === "/" || location.pathname === "/auth") {
      if ((token_hash || code) && type === "recovery") {
        throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
      }

      if (code || type === "signup" || type === "invite") {
        throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
      }
      
      if (location.pathname === "/auth") {
        throw redirect({ to: "/login", replace: true });
      }
    }
  },
  component: () => <Outlet />,
});
