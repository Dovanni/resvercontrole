import { describe, expect, it } from "vitest";
import { editorialSectionsToText, editorialTextToSections, parseEditorialTagInput, slugifyEditorialTag } from "./editorial-editor-input";

describe("editorial editor input", () => {
  it("keeps the legacy multiline block contract stable", () => {
    const text = "Título da seção\nPrimeiro parágrafo\nSegundo parágrafo\n\nOutra seção\nOutro texto";
    const sections = editorialTextToSections(text);

    expect(sections).toEqual([
      { heading: "Título da seção", paragraphs: ["Primeiro parágrafo", "Segundo parágrafo"] },
      { heading: "Outra seção", paragraphs: ["Outro texto"] },
    ]);
  });

  it("treats blank-line-separated prose as paragraphs without duplicating it as headings", () => {
    const text = "Primeiro parágrafo editorial.\n\nSegundo parágrafo editorial.";
    const sections = editorialTextToSections(text);

    expect(sections).toEqual([
      {
        heading: "Introdução",
        paragraphs: ["Primeiro parágrafo editorial.", "Segundo parágrafo editorial."],
      },
    ]);
  });

  it("uses explicit markdown-style headings for structured sections", () => {
    const text = "## Controle de estoque\n\nPrimeiro parágrafo.\n\nSegundo parágrafo.\n\n## Inventário\n\nTerceiro parágrafo.";
    const sections = editorialTextToSections(text);

    expect(sections).toEqual([
      { heading: "Controle de estoque", paragraphs: ["Primeiro parágrafo.", "Segundo parágrafo."] },
      { heading: "Inventário", paragraphs: ["Terceiro parágrafo."] },
    ]);
  });

  it("preserves internal and external links while parsing natural paragraphs", () => {
    const text = "## Referências\n\nConsulte a [curva ABC](/) e as [orientações do Sebrae](https://www.sebrae.com.br/).";
    const sections = editorialTextToSections(text);

    expect(sections).toEqual([
      {
        heading: "Referências",
        paragraphs: [
          {
            type: "rich_text",
            content: [
              { type: "text", text: "Consulte a " },
              { type: "link", text: "curva ABC", href: "/" },
              { type: "text", text: " e as " },
              { type: "link", text: "orientações do Sebrae", href: "https://www.sebrae.com.br/" },
              { type: "text", text: "." },
            ],
          },
        ],
      },
    ]);
  });

  it("round-trips structured sections with explicit headings and no duplicate paragraphs", () => {
    const sections = [
      {
        heading: "Controle de estoque",
        paragraphs: ["Primeiro parágrafo.", "Segundo parágrafo."],
      },
      {
        heading: "Inventário",
        paragraphs: ["Terceiro parágrafo."],
      },
    ];

    const text = editorialSectionsToText(sections);
    expect(text).toBe("## Controle de estoque\n\nPrimeiro parágrafo.\n\nSegundo parágrafo.\n\n## Inventário\n\nTerceiro parágrafo.");
    expect(editorialTextToSections(text)).toEqual(sections);
  });

  it("supports semantic H3 sections without changing the legacy H2 shape", () => {
    const text = "## Gestão financeira\n\nParágrafo principal.\n\n### Fluxo de caixa\n\nParágrafo específico.";
    const sections = editorialTextToSections(text);

    expect(sections).toEqual([
      { heading: "Gestão financeira", paragraphs: ["Parágrafo principal."] },
      { heading: "Fluxo de caixa", headingLevel: 3, paragraphs: ["Parágrafo específico."] },
    ]);
    expect(editorialSectionsToText(sections)).toBe(text);
  });

  it("removes duplicated markdown markers when serializing legacy headings", () => {
    const sections = [{ heading: "## ERP para gestão comercial e financeira", paragraphs: ["Conteúdo."] }];
    expect(editorialSectionsToText(sections)).toBe("## ERP para gestão comercial e financeira\n\nConteúdo.");
  });

  it("preserves the VEJAMAIS internal anchor and HTTPS external link", () => {
    const text = "## Referências\n\nConheça os [recursos do VEJAMAIS ERP](/#recursos) e consulte o [Sebrae](https://sebrae.com.br/).";
    expect(editorialSectionsToText(editorialTextToSections(text))).toBe(text);
  });

  it("accepts commas semicolons and line breaks for multiple tags", () => {
    expect(parseEditorialTagInput("Teste, Agendamento; Validação\nTeste")).toEqual(["Teste", "Agendamento", "Validação"]);
  });

  it("creates safe deterministic tag slugs", () => {
    expect(slugifyEditorialTag("Validação Financeira")).toBe("validacao-financeira");
  });
});
