import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { blogSupabase } from "./blog-supabase";

export interface BlogEditorialAuthState {
  user: User | null;
  loading: boolean;
}

/**
 * Auth state dedicated to Blog Editorial V2.
 * This hook must never consume the ERP AuthProvider or the global ERP client.
 */
export function useBlogEditorialAuth(): BlogEditorialAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    blogSupabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = blogSupabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export async function signInBlogEditorial(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) throw new Error("BLOG_EDITORIAL_CREDENTIALS_REQUIRED");

  const { data, error } = await blogSupabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) throw error;
  if (!data.user) throw new Error("BLOG_EDITORIAL_AUTH_FAILED");
  return data.user;
}

export async function signOutBlogEditorial() {
  const { error } = await blogSupabase.auth.signOut();
  if (error) throw error;
}

export function BlogEditorialSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signInBlogEditorial(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível autenticar a conta editorial.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 max-w-sm space-y-4 text-left">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">E-mail editorial</span>
        <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm" required />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Senha</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm" required />
      </label>
      {error && <p className="rounded-xl border p-3 text-sm text-muted-foreground">Falha na autenticação editorial. Verifique as credenciais e tente novamente.</p>}
      <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {submitting ? "Entrando…" : "Entrar no Editorial"}
      </button>
      <p className="text-center text-xs leading-5 text-muted-foreground">Esta sessão é exclusiva do Blog Editorial e não altera a sessão do ERP.</p>
    </form>
  );
}
