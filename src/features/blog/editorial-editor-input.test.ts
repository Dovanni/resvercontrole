import { describe, expect, it } from "vitest";
import { editorialSectionsToText, editorialTextToSections, parseEditorialTagInput, slugifyEditorialTag } from "./editorial-editor-input";

describe("editorial editor input", () => {
  it("keeps multiple typed lines stable until explicit conversion", () => {
    const text = "Título da seção\nPrimeiro parágrafo\nSegundo parágrafo\n\nOutra seção\nOutro texto";
    const sections = editorialTextToSections(text);
    expect(editorialSectionsToText(sections)).toBe(text);
  });

  it("accepts commas semicolons and line breaks for multiple tags", () => {
    expect(parseEditorialTagInput("Teste, Agendamento; Validação\nTeste")).toEqual(["Teste", "Agendamento", "Validação"]);
  });

  it("creates safe deterministic tag slugs", () => {
    expect(slugifyEditorialTag("Validação Financeira")).toBe("validacao-financeira");
  });
});
