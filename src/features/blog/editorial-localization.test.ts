import { describe, expect, it } from "vitest";
import {
  blogPostStatusLabel,
  editorialRoleLabel,
  revisionLabel,
  workflowStatusLabel,
} from "./editorial-localization";

describe("editorial localization pt-BR", () => {
  it("localizes editorial roles without changing internal role values", () => {
    expect(editorialRoleLabel("owner")).toBe("Proprietário");
    expect(editorialRoleLabel("editor")).toBe("Editor");
    expect(editorialRoleLabel("author")).toBe("Autor");
    expect(editorialRoleLabel("reviewer")).toBe("Revisor");
  });

  it("localizes blog workflow statuses", () => {
    expect(blogPostStatusLabel("draft")).toBe("Rascunho");
    expect(blogPostStatusLabel("review")).toBe("Em revisão");
    expect(blogPostStatusLabel("scheduled")).toBe("Agendado");
    expect(blogPostStatusLabel("published")).toBe("Publicado");
    expect(blogPostStatusLabel("archived")).toBe("Arquivado");
  });

  it("localizes workflow origin and revision labels", () => {
    expect(workflowStatusLabel(null)).toBe("Início");
    expect(workflowStatusLabel("review")).toBe("Em revisão");
    expect(revisionLabel(3)).toBe("revisão 3");
  });

  it("keeps unknown future roles visible instead of hiding them", () => {
    expect(editorialRoleLabel("future_role")).toBe("future_role");
  });
});
