import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    // 1. Permitir que rotas filhas renderizem (IMPORTANTE: verificar se o pathname começa com /auth/callback)
    if (location.pathname.startsWith("/auth/callback")) {
      return;
    }

    // 2. Redirecionar acessos com parâmetros para as rotas corretas
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    if ((token_hash || code) && type === "recovery") {
      throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
    }

    if (code || type === "signup" || type === "invite") {
      throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
    }

    // 3. Fallback total para login
    throw redirect({ to: "/login", replace: true });
  },
  component: () => <Outlet />,
});






