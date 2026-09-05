import { describe, expect, it } from "vitest";
import {
  isSafeBlogLinkHref,
  normalizeBlogSections,
  parseEditorialParagraph,
  serializeEditorialParagraph,
  validateStructuredBlogLinks,
} from "./blog-content";

describe("Blog structured content links", () => {
  it("accepts only internal paths and HTTPS URLs", () => {
    expect(isSafeBlogLinkHref("/blog/fluxo-de-caixa")).toBe(true);
    expect(isSafeBlogLinkHref("https://vejamais.com.br/blog")).toBe(true);
    expect(isSafeBlogLinkHref("javascript:alert(1)")).toBe(false);
    expect(isSafeBlogLinkHref("data:text/html,boom")).toBe(false);
    expect(isSafeBlogLinkHref("http://example.com")).toBe(false);
    expect(isSafeBlogLinkHref("//evil.example")).toBe(false);
  });

  it("round-trips editorial link syntax into structured content", () => {
    const source = "Veja [fluxo de caixa](/blog/fluxo-de-caixa) e [guia externo](https://example.com/guia).";
    const paragraph = parseEditorialParagraph(source);
    expect(typeof paragraph).not.toBe("string");
    expect(serializeEditorialParagraph(paragraph)).toBe(source);
  });

  it("keeps legacy string paragraphs compatible", () => {
    expect(normalizeBlogSections([{ heading: "Seção", paragraphs: ["Parágrafo legado"] }])).toEqual([
      { heading: "Seção", paragraphs: ["Parágrafo legado"] },
    ]);
  });

  it("normalizes stored rich text paragraphs", () => {
    expect(normalizeBlogSections([{ heading: "Links", paragraphs: [{ type: "rich_text", content: [
      { type: "text", text: "Leia " },
      { type: "link", text: "este artigo", href: "/blog/artigo" },
    ] }] }])).toEqual([{ heading: "Links", paragraphs: [{ type: "rich_text", content: [
      { type: "text", text: "Leia " },
      { type: "link", text: "este artigo", href: "/blog/artigo" },
    ] }] }]);
  });

  it("rejects dangerous protocols before editorial persistence", () => {
    const sections = [{
      heading: "Segurança",
      paragraphs: [parseEditorialParagraph("Não aceite [este link](javascript:alert(1)).")],
    }];
    expect(validateStructuredBlogLinks(sections)).toBe("BLOG_LINK_INVALID_HREF");
  });
});
