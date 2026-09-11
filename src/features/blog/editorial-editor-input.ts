import { parseEditorialParagraph, serializeEditorialParagraph } from "./blog-content";
import type { BlogArticleSection } from "./types";

const EXPLICIT_HEADING_PATTERN = /^##\s+(.+)$/;
const INTRODUCTION_HEADING = "Introdução";

function paragraphHasText(paragraph: ReturnType<typeof parseEditorialParagraph>) {
  if (typeof paragraph === "string") return paragraph.length > 0;
  return paragraph.content.some((item) => item.text.length > 0);
}

export function editorialSectionsToText(sections: BlogArticleSection[]) {
  return sections
    .map((section) => [
      `## ${section.heading}`,
      ...section.paragraphs.map(serializeEditorialParagraph),
    ].filter(Boolean).join("\n\n"))
    .join("\n\n");
}

export function editorialTextToSections(value: string): BlogArticleSection[] {
  const normalized = value.replace(/\r\n/g, "\n");
  if (!normalized.trim()) return [{ heading: "", paragraphs: [""] }];

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sections: BlogArticleSection[] = [];
  let current: BlogArticleSection | null = null;

  const ensureCurrent = () => {
    if (!current) {
      current = { heading: INTRODUCTION_HEADING, paragraphs: [] };
      sections.push(current);
    }
    return current;
  };

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    if (lines.length === 1) {
      const explicitHeading = lines[0].match(EXPLICIT_HEADING_PATTERN);
      if (explicitHeading) {
        current = { heading: explicitHeading[1].trim(), paragraphs: [] };
        sections.push(current);
        continue;
      }

      const paragraph = parseEditorialParagraph(lines[0]);
      if (paragraphHasText(paragraph)) ensureCurrent().paragraphs.push(paragraph);
      continue;
    }

    // Backward compatibility for the original editor contract:
    // a multi-line block is still interpreted as heading + paragraphs.
    current = {
      heading: lines[0],
      paragraphs: lines
        .slice(1)
        .map((line) => parseEditorialParagraph(line))
        .filter(paragraphHasText),
    };
    sections.push(current);
  }

  return sections.length ? sections : [{ heading: "", paragraphs: [""] }];
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
