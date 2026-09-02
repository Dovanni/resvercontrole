import { describe, expect, it } from "vitest";
import { mapAuthorReference, mapPostListItem, mapReference } from "./editorial-read-model";

describe("Blog Editorial V2 administrative read model", () => {
  it("maps an administrative post without leaking write behavior", () => {
    const mapped = mapPostListItem({
      id: "post-1", slug: "fluxo-caixa", title: "Fluxo de caixa", status: "review", revision_number: 4,
      updated_at: "2026-09-02T19:00:00.000Z", scheduled_at: null, published_at: null,
      created_by: "user-a", updated_by: "user-b",
      blog_categories: { name: "Gestão Financeira" },
      blog_authors: [{ display_name: "Equipe Editorial VEJAMAIS ERP" }],
    });
    expect(mapped).toEqual(expect.objectContaining({ id: "post-1", status: "review", revisionNumber: 4, category: "Gestão Financeira", author: "Equipe Editorial VEJAMAIS ERP" }));
    expect(mapped).not.toHaveProperty("content");
  });

  it("maps category/tag references to the canonical resolver contract", () => {
    expect(mapReference({ id: "cat-1", slug: "gestao", name: "Gestão", is_active: true })).toEqual({ id: "cat-1", slug: "gestao", name: "Gestão", active: true });
  });

  it("maps authors to the canonical resolver contract", () => {
    expect(mapAuthorReference({ id: "author-1", slug: "equipe", display_name: "Equipe Editorial", is_active: true })).toEqual({ id: "author-1", slug: "equipe", displayName: "Equipe Editorial", active: true });
  });

  it("preserves null category/author when relations are absent", () => {
    const mapped = mapPostListItem({
      id: "post-2", slug: "draft", title: "Draft", status: "draft", revision_number: 1,
      updated_at: "2026-09-02T19:00:00.000Z", scheduled_at: null, published_at: null,
      created_by: "user-a", updated_by: null, blog_categories: null, blog_authors: null,
    });
    expect(mapped.category).toBeNull();
    expect(mapped.author).toBeNull();
  });
});
