import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // 1. Prioridade absoluta: Se houver parâmetros de fluxo, redirecionar para as rotas dedicadas
    if ((token_hash || code) && type === "recovery") {
      if (location.pathname === "/auth/callback/recovery") return;
      throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
    }

    if (code || type === "signup" || type === "invite") {
      if (location.pathname === "/auth/callback") return;
      throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
    }

    // 2. Se estiver na raiz /auth sem parâmetros identificados, redireciona para login
    if (location.pathname === "/auth" || location.pathname === "/auth/") {
      throw redirect({ to: "/login", replace: true });
    }
    
    // 3. Se estiver em uma sub-rota filha (/auth/callback/*) sem parâmetros,
    // o componente da própria rota lidará com o estado de erro.
  },
  component: () => <Outlet />,
});
