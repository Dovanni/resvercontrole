import { parseEditorialParagraph, serializeEditorialParagraph } from "./blog-content";
import type { BlogArticleSection } from "./types";

export function editorialSectionsToText(sections: BlogArticleSection[]) {
  return sections
    .map((section) => [section.heading, ...section.paragraphs.map(serializeEditorialParagraph)].filter(Boolean).join("\n"))
    .join("\n\n");
}

export function editorialTextToSections(value: string): BlogArticleSection[] {
  const normalized = value.replace(/\r\n/g, "\n");
  if (!normalized.trim()) return [{ heading: "", paragraphs: [""] }];

  const blocks = normalized.split(/\n\s*\n/).filter((block) => block.trim().length > 0);
  return blocks.map((block, index) => {
    const lines = block.split("\n");
    const heading = (lines[0] ?? "").trim() || `Seção ${index + 1}`;
    const paragraphLines = lines.slice(1);
    const paragraphs = paragraphLines.length
      ? paragraphLines.map((line) => parseEditorialParagraph(line)).filter((paragraph) => {
          if (typeof paragraph === "string") return paragraph.length > 0;
          return paragraph.content.some((item) => item.text.length > 0);
        })
      : [parseEditorialParagraph(heading)];

    return { heading, paragraphs: paragraphs.length ? paragraphs : [""] };
  });
}

export function parseEditorialTagInput(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function slugifyEditorialTag(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
