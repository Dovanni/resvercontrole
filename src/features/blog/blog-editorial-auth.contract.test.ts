import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Blog Editorial auth isolation contract", () => {
  it("binds editorial auth exclusively to blogSupabase", () => {
    const source = read("src/features/blog/blog-editorial-auth.tsx");

    expect(source).toContain('import { blogSupabase } from "./blog-supabase.client"');
    expect(source).toContain("blogSupabase.auth.getSession()");
    expect(source).toContain("blogSupabase.auth.onAuthStateChange");
    expect(source).toContain("blogSupabase.auth.signInWithPassword");
    expect(source).not.toContain("@/lib/auth");
    expect(source).not.toContain("@/integrations/supabase/client");
  });

  it.each([
    "src/routes/editorial.tsx",
    "src/routes/editorial_.editor.tsx",
  ])("keeps %s detached from ERP authentication", (path) => {
    const source = read(path);

    expect(source).toContain("useBlogEditorialAuth");
    expect(source).not.toContain('from "@/lib/auth"');
    expect(source).not.toContain('to="/login"');
  });

  it("keeps editorial persistence fail-closed", () => {
    const source = read("src/features/blog/editorial-supabase-write.adapter.ts");

    expect(source).toContain("EDITORIAL_SUPABASE_WRITES_ENABLED = false");
    expect(source).toContain('EDITORIAL_SUPABASE_WRITE_MODE = "disabled_repository_only"');
  });
});
