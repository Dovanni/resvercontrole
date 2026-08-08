import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ search, location }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // Se estivermos na raiz exata com parâmetros de auth
    if (location.pathname === "/") {
       if ((token_hash || code) && type === "recovery") {
         throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
       }
       if (code || type === "signup" || type === "invite") {
         throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
       }
    }
  },
  component: () => <Outlet />,
});
