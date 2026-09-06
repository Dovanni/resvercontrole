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
  value.includeInSitemap = true;
  return value;
}

describe("editorial SEO write gate", () => {
  it("sends the live 19-argument RPC payload after R4 persistence validation", () => {
    const args = buildOperationalDraftRpcArgs(form(), {
      categoryId: "00000000-0000-0000-0000-000000000001",
      authorId: "00000000-0000-0000-0000-000000000002",
      tagIds: [],
    });

    expect(Object.keys(args)).toHaveLength(19);
    expect(args).toMatchObject({
      p_seo_allow_indexing: false,
      p_seo_allow_following: false,
      p_seo_include_in_sitemap: false,
    });
  });
});
