import { createClient } from "@supabase/supabase-js";

function createBlogSupabaseClient() {
  const BLOG_SUPABASE_URL = import.meta.env.VITE_BLOG_SUPABASE_URL || process.env.BLOG_SUPABASE_URL;
  const BLOG_SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_BLOG_SUPABASE_PUBLISHABLE_KEY || process.env.BLOG_SUPABASE_PUBLISHABLE_KEY;

  if (!BLOG_SUPABASE_URL || !BLOG_SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!BLOG_SUPABASE_URL ? ["BLOG_SUPABASE_URL"] : []),
      ...(!BLOG_SUPABASE_PUBLISHABLE_KEY ? ["BLOG_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Blog Supabase environment variable(s): ${missing.join(", ")}`);
  }

  return createClient(BLOG_SUPABASE_URL, BLOG_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      storageKey: "vejamais-blog-auth",
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _blogSupabase: ReturnType<typeof createBlogSupabaseClient> | undefined;

/**
 * Supabase client dedicated to Blog Editorial V2.
 * It must never fall back to the ERP VITE_SUPABASE_* configuration.
 */
export const blogSupabase = new Proxy({} as ReturnType<typeof createBlogSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_blogSupabase) _blogSupabase = createBlogSupabaseClient();
    return Reflect.get(_blogSupabase, prop, receiver);
  },
});
