import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ search }) => {
    // Preservar parâmetros se existirem (para o callback)
    const code = (search as any).code;
    if (code) {
      throw redirect({ to: "/auth/callback", search: { code }, replace: true });
    }
    throw redirect({ to: "/login", replace: true });
  },
  component: () => null,
});

