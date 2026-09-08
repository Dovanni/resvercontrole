import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/features/blog/blog.repository.ts"), "utf8");

describe("Blog public SEO read model contract", () => {
  it("selects the canonical persisted SEO columns through the shared readiness helper", () => {
    expect(source).toContain("withBlogSeoPersistenceSelect");
    expect(source).toContain("const BLOG_POST_SELECT = withBlogSeoPersistenceSelect(`");
  });

  it("maps published SEO from persistence instead of forcing historical true defaults", () => {
    expect(source).toContain("seo: persistedBlogSeoSettings(row)");
    expect(source).not.toContain("allowIndexing: true,\n      allowFollowing: true,\n      includeInSitemap: true");
  });

  it("keeps public visibility restricted to due published posts", () => {
    expect(source).toContain('.eq("status", "published")');
    expect(source).toContain('.lte("published_at", new Date().toISOString())');
  });
});
