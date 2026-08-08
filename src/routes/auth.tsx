import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search }) => {
    // Preservar parâmetros se existirem (para o callback)
    const searchParams = search as any;
    const code = searchParams.code;
    const type = searchParams.type;

    // Se houver código PKCE ou tipo de fluxo identificado, vai para o callback canônico
    if (code || type === "recovery" || type === "signup" || type === "invite") {
      throw redirect({ 
        to: "/auth/callback", 
        search: { ...searchParams }, 
        replace: true 
      });
    }
    throw redirect({ to: "/login", replace: true });
  },
  component: () => null,
});

