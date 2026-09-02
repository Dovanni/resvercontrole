import { describe, expect, it } from "vitest";
import { articleToEditorialForm } from "./editorial-workflow";
import { listPreviewBlogArticles } from "./blog.repository";
import { orchestrateEditorialWrite, type EditorialReferenceCatalogSnapshot } from "./editorial-write-orchestrator";
import { EDITORIAL_DRAFT_RPC_NAME, executeEditorialDraftRpc, planEditorialDraftRpc } from "./editorial-draft-rpc.adapter";

const actor = { userId: "editor-user", role: "editor" as const, authorId: null };
const catalog: EditorialReferenceCatalogSnapshot = {
  loadedAt: "2026-09-02T20:30:00Z",
  source: "repository_only_fixture",
  categories: [{ id: "cat-1", slug: "gestao-empresarial", name: "Gestão Empresarial", active: true }],
  authors: [{ id: "author-1", slug: "equipe-editorial-vejamais-erp", displayName: "Equipe Editorial VEJAMAIS ERP", active: true }],
  tags: [
    { id: "tag-1", slug: "gestao", name: "gestão", active: true },
    { id: "tag-2", slug: "erp", name: "ERP", active: true },
  ],
};

function form() {
  const article = listPreviewBlogArticles()[0];
  return {
    ...articleToEditorialForm({ ...article, category: "Gestão Empresarial", author: "Equipe Editorial VEJAMAIS ERP", tags: ["gestão", "ERP"] }),
    createdByUserId: actor.userId,
  };
}

describe("Fase 3-U.1 repository-only draft RPC adapter", () => {
  it("maps createDraft to the canonical atomic RPC contract", () => {
    const orchestration = orchestrateEditorialWrite({ command: "createDraft", actor, form: form(), catalog });
    const rpc = planEditorialDraftRpc(orchestration);
    expect(rpc.functionName).toBe(EDITORIAL_DRAFT_RPC_NAME);
    expect(rpc.atomic).toBe(true);
    expect(rpc.executable).toBe(false);
    expect(rpc.args).toMatchObject({
      p_operation: "create",
      p_post_id: null,
      p_expected_revision: null,
      p_category_id: "cat-1",
      p_author_id: "author-1",
      p_tag_ids: ["tag-1", "tag-2"],
    });
  });

  it("maps updateDraft with the optimistic revision guard", () => {
    const orchestration = orchestrateEditorialWrite({ command: "updateDraft", actor, form: { ...form(), id: "post-1", revisionNumber: 8 }, catalog });
    const rpc = planEditorialDraftRpc(orchestration);
    expect(rpc.args.p_operation).toBe("update");
    expect(rpc.args.p_post_id).toBe("post-1");
    expect(rpc.args.p_expected_revision).toBe(8);
  });

  it("refuses non-draft commands", () => {
    const orchestration = orchestrateEditorialWrite({ command: "submitReview", actor, form: { ...form(), id: "post-1" }, catalog });
    expect(() => planEditorialDraftRpc(orchestration)).toThrow("BLOG_EDITORIAL_DRAFT_RPC_COMMAND_UNSUPPORTED");
  });

  it("refuses unresolved references", () => {
    const orchestration = orchestrateEditorialWrite({ command: "updateDraft", actor, form: { ...form(), id: "post-1", category: "Inexistente" }, catalog });
    expect(() => planEditorialDraftRpc(orchestration)).toThrow("BLOG_EDITORIAL_DRAFT_RPC_PLAN_NOT_READY");
  });

  it("keeps execution fail-closed until the RPC is applied and explicitly enabled", async () => {
    const orchestration = orchestrateEditorialWrite({ command: "updateDraft", actor, form: { ...form(), id: "post-1" }, catalog });
    const rpc = planEditorialDraftRpc(orchestration);
    await expect(executeEditorialDraftRpc(rpc)).rejects.toThrow("BLOG_EDITORIAL_DRAFT_RPC_NOT_APPLIED_OR_ENABLED");
  });
});
