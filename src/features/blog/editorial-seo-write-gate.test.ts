import { describe, expect, it } from "vitest";
import { buildOperationalDraftRpcArgs } from "./editorial-operational-write";
import { createEmptyEditorialForm } from "./editorial-workflow";

function form() {
  const value = createEmptyEditorialForm();
  value.slug = "artigo-teste";
  value.title = "Artigo teste";
  value.excerpt = "Resumo";
  value.category = "Gestão";
  value.author = "Equipe";
  value.allowIndexing = false;
  value.allowFollowing = false;
  value.includeInSitemap = false;
  return value;
}

describe("editorial SEO write gate", () => {
  it("keeps the current live RPC payload on 16 arguments while R2 is not applied", () => {
    const args = buildOperationalDraftRpcArgs(form(), {
      categoryId: "00000000-0000-0000-0000-000000000001",
      authorId: "00000000-0000-0000-0000-000000000002",
      tagIds: [],
    });

    expect(Object.keys(args)).toHaveLength(16);
    expect(args).not.toHaveProperty("p_seo_allow_indexing");
    expect(args).not.toHaveProperty("p_seo_allow_following");
    expect(args).not.toHaveProperty("p_seo_include_in_sitemap");
  });
});
