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

  it("routes public visibility through the zero-downtime published revision RPCs", () => {
    expect(source).toContain('.rpc("blog_public_list_posts")');
    expect(source).toContain('.rpc("blog_public_get_post_by_slug"');
    expect(source).not.toContain('.eq("status", "published")');
  });
});
