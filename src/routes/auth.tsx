import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    // Preservar parâmetros se existirem (para o callback)
    const searchParams = search as any;
    const code = searchParams.code;
    const type = searchParams.type;
    const token_hash = searchParams.token_hash;

    // Se houver token_hash e type=recovery, vai para o callback de recuperação dedicado
    if ((token_hash || code) && type === "recovery") {
      if (location.pathname === "/auth/callback/recovery") return;
      throw redirect({ 
        to: "/auth/callback/recovery", 
        search: { ...searchParams }, 
        replace: true 
      });
    }

    // Se houver código PKCE ou tipo de fluxo identificado (signup/invite), vai para o callback padrão
    if (code || type === "signup" || type === "invite") {
      if (location.pathname === "/auth/callback") return;
      throw redirect({ 
        to: "/auth/callback", 
        search: { ...searchParams }, 
        replace: true 
      });
    }

    // Se acessado diretamente /auth ou sub-rotas sem parâmetros de fluxo válidos, vai para login
    // Exceto se já estivermos em uma rota de callback que queremos renderizar (Outlet cuidará disso)
    if (location.pathname === "/auth") {
      throw redirect({ to: "/login", replace: true });
    }
  },
  component: () => <Outlet />,
});



