import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search, location }) => {
    // Preservar parâmetros se existirem (para o callback)
    const searchParams = search as any;
    const code = searchParams.code;
    const type = searchParams.type;
    const token_hash = searchParams.token_hash;

    // Se já estamos no pathname de destino do redirecionamento, não redirecionar (evita loop)
    // Nota: TanStack Router normaliza pathnames.
    
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

    // Fallback padrão se não houver parâmetros de fluxo
    throw redirect({ to: "/login", replace: true });
  },
  component: () => null,
});

