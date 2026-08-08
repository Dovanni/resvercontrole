import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    // 1. Prioridade absoluta: Se houver parâmetros de fluxo, redirecionar para as rotas dedicadas
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // Se houver token_hash e type=recovery, vai para o callback de recuperação dedicado
    if ((token_hash || code) && type === "recovery") {
      if (location.pathname === "/auth/callback/recovery") return;
      throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
    }

    // Se houver código PKCE ou tipo de fluxo identificado (signup/invite), vai para o callback padrão
    if (code || type === "signup" || type === "invite") {
      if (location.pathname === "/auth/callback") return;
      throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
    }

    // 2. Se estiver na raiz /auth sem parâmetros identificados, redireciona para login
    if (location.pathname === "/auth") {
      throw redirect({ to: "/login", replace: true });
    }

    // 3. Se estiver em uma sub-rota filha (/auth/callback/*) e não tiver parâmetros,
    // NÃO redirecionamos. Deixamos o componente da própria rota montar e exibir 
    // seu estado finito de erro (ex: "Link ausente").
  },
  component: () => <Outlet />,
});
