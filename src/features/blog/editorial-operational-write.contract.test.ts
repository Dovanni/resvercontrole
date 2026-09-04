import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Blog Editorial operational write contract", () => {
  it("activates only the dedicated Blog Supabase write path", () => {
    const source = read("src/features/blog/editorial-operational-write.ts");

    expect(source).toContain('import { blogSupabase } from "./blog-supabase"');
    expect(source).toContain("EDITORIAL_OPERATIONAL_WRITES_ENABLED = true");
    expect(source).toContain('EDITORIAL_OPERATIONAL_WRITE_MODE = "live_blog_supabase"');
    expect(source).toContain('rpc("blog_save_draft_transaction"');
    expect(source).toContain('from("blog_post_reviews")');
    expect(source).toContain('from("blog_posts")');
    expect(source).not.toContain("@/integrations/supabase/client");
  });

  it("keeps the legacy controlled executor detached from ERP Supabase", () => {
    const source = read("src/features/blog/editorial-controlled-write.executor.ts");
    expect(source).toContain('import { blogSupabase as supabase } from "./blog-supabase"');
    expect(source).not.toContain("@/integrations/supabase/client");
  });

  it("turns the editor from simulation into explicit operational commands", () => {
    const route = read("src/routes/editorial_.editor.tsx");
    expect(route).toContain("executeOperationalEditorialCommand");
    expect(route).toContain("Novo draft");
    expect(route).toContain("Publicar agora");
    expect(route).toContain("Persistência ativa");
    expect(route).not.toContain("Simular salvar draft");
    expect(route).not.toContain("Workflow simulado");
  });
});
