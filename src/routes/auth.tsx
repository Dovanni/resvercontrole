import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // Se houver parâmetros de recuperação, redireciona para a rota dedicada
    if ((token_hash || code) && type === "recovery") {
      // Se já estamos no destino, não redirecionamos
      if (location.pathname === "/auth/callback/recovery") return;
      
      throw redirect({ 
        to: "/auth/callback/recovery", 
        search: { ...searchParams }, 
        replace: true 
      });
    }

    // Se houver parâmetros de cadastro/convite, redireciona para o callback padrão
    if (code || type === "signup" || type === "invite") {
      if (location.pathname === "/auth/callback") return;
      
      throw redirect({ 
        to: "/auth/callback", 
        search: { ...searchParams }, 
        replace: true 
      });
    }

    // Se for acessado /auth diretamente sem parâmetros, redireciona para login
    if (location.pathname === "/auth") {
      throw redirect({ to: "/login", replace: true });
    }
  },
  component: () => <Outlet />,
});
