import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Blog Supabase client isolation contract", () => {
  it("uses dedicated Blog environment variables and an isolated auth storage key", () => {
    const source = read("src/features/blog/blog-supabase.ts");

    expect(source).toContain("VITE_BLOG_SUPABASE_URL");
    expect(source).toContain("VITE_BLOG_SUPABASE_PUBLISHABLE_KEY");
    expect(source).toContain('storageKey: "vejamais-blog-auth"');
    expect(source).not.toContain("@/integrations/supabase/client");
  });

  it.each([
    "src/features/blog/blog.repository.ts",
    "src/features/blog/editorial-read-model.ts",
    "src/features/blog/editorial-editor-read-model.ts",
  ])("keeps %s detached from the ERP Supabase client", (path) => {
    const source = read(path);

    expect(source).toContain("blogSupabase");
    expect(source).toContain('from "./blog-supabase"');
    expect(source).not.toContain("@/integrations/supabase/client");
    expect(source).not.toContain("./blog-supabase.client");
  });

  it("keeps ERP and Blog production configuration side by side", () => {
    const env = read(".env.production");

    expect(env).toContain("VITE_SUPABASE_URL=");
    expect(env).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=");
    expect(env).toContain("VITE_BLOG_SUPABASE_URL=");
    expect(env).toContain("VITE_BLOG_SUPABASE_PUBLISHABLE_KEY=");
  });
});
