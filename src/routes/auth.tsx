import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    // 1. Permitir que rotas filhas (callback e recovery) renderizem seus próprios componentes
    // Se o pathname for uma sub-rota de /auth/callback, não redirecionamos aqui.
    if (location.pathname.startsWith("/auth/callback")) {
      return;
    }

    // 2. Lógica de roteamento baseada em parâmetros (para compatibilidade com links legados ou externos)
    const searchParams = search as any;
    const code = searchParams.code;
    const type = searchParams.type;
    const token_hash = searchParams.token_hash;

    // Se houver token_hash e type=recovery, vai para o callback de recuperação dedicado
    if ((token_hash || code) && type === "recovery") {
      throw redirect({ 
        to: "/auth/callback/recovery", 
        search: { ...searchParams }, 
        replace: true 
      });
    }

    // Se houver código PKCE ou tipo de fluxo identificado (signup/invite), vai para o callback padrão
    if (code || type === "signup" || type === "invite") {
      throw redirect({ 
        to: "/auth/callback", 
        search: { ...searchParams }, 
        replace: true 
      });
    }

    // 3. Fallback: Se for a raiz /auth ou qualquer outra coisa não identificada, vai para login
    throw redirect({ to: "/login", replace: true });
  },
  component: () => <Outlet />,
});





