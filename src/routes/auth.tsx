import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // 1. Prioridade absoluta: Redirecionar parâmetros de fluxo para as rotas dedicadas
    if ((token_hash || code) && type === "recovery") {
      if (location.pathname === "/auth/callback/recovery") return;
      throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
    }

    if (code || type === "signup" || type === "invite") {
      if (location.pathname === "/auth/callback") return;
      throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
    }

    // 2. Se estiver na raiz /auth sem parâmetros, vai para login
    if (location.pathname === "/auth") {
      throw redirect({ to: "/login", replace: true });
    }

    // 3. Se estiver em uma sub-rota (ex: /auth/callback/recovery) e NÃO tiver parâmetros,
    // o componente da própria rota lidará com o estado de erro.
  },
  component: () => <Outlet />,
});
