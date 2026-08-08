import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ search, location }) => {
    const searchParams = search as any;
    const { code, type, token_hash } = searchParams;

    // Captura parâmetros de auth que caíram na raiz (root redirection logic)
    if (location.pathname === "/") {
      if ((token_hash || code) && type === "recovery") {
        throw redirect({ to: "/auth/callback/recovery", search: { ...searchParams }, replace: true });
      }

      if (code || type === "signup" || type === "invite") {
        throw redirect({ to: "/auth/callback", search: { ...searchParams }, replace: true });
      }
    }
  },
  component: () => <Outlet />,
});


