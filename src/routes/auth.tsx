import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // 1. Redirecionar parâmetros de fluxo para as rotas corretas (Gate global para links de e-mail)
    if ((token_hash || code) && type === "recovery") {
      if (location.pathname === "/auth/callback/recovery") return;
      throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
    }

    if (code || type === "signup" || type === "invite") {
      if (location.pathname === "/auth/callback") return;
      throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
    }

    // 2. Se for /auth ou qualquer sub-rota de auth sem parâmetros válidos, vai para login
    // IMPORTANTE: Só redirecionamos se NÃO estivermos em uma rota que deve ser renderizada.
    // TanStack Start re-avalia o beforeLoad do pai em toda navegação.
    // Mas se acessarmos /auth/callback/recovery diretamente sem parâmetros, searchParams estará vazio.
    // Se redirecionarmos para login aqui, nunca veremos o componente de erro da filha.
    
    if (location.pathname === "/auth" || location.pathname === "/auth/") {
      throw redirect({ to: "/login", replace: true });
    }
    
    // Para sub-rotas como /auth/callback/recovery sem parâmetros, 
    // permitimos o acesso para que o componente exiba "Link ausente".
  },
  component: () => <Outlet />,
});

