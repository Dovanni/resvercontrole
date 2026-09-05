import type { BlogArticleParagraph, BlogArticleSection, BlogInlineContent } from "./types";

const EDITOR_LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;

export function isSafeBlogLinkHref(href: string) {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeBlogParagraph(value: unknown): BlogArticleParagraph | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }
  if (!value || typeof value !== "object" || !("type" in value) || value.type !== "rich_text" || !("content" in value) || !Array.isArray(value.content)) {
    return null;
  }

  const content = value.content.flatMap<BlogInlineContent>((item) => {
    if (!item || typeof item !== "object" || !("type" in item) || !("text" in item) || typeof item.text !== "string") return [];
    const text = item.text;
    if (!text) return [];
    if (item.type === "text") return [{ type: "text", text }];
    if (item.type === "link" && "href" in item && typeof item.href === "string") {
      return [{ type: "link", text, href: item.href.trim() }];
    }
    return [];
  });

  return content.length ? { type: "rich_text", content } : null;
}

export function normalizeBlogSections(content: unknown): BlogArticleSection[] {
  if (!Array.isArray(content)) return [];
  const sections: BlogArticleSection[] = [];
  let current: BlogArticleSection | null = null;

  const flushCurrent = () => {
    if (current?.heading && current.paragraphs.length > 0) sections.push(current);
    current = null;
  };

  for (const block of content) {
    if (!block || typeof block !== "object") continue;

    const legacyHeading = "heading" in block && typeof block.heading === "string" ? block.heading.trim() : "";
    const legacyParagraphs =
      "paragraphs" in block && Array.isArray(block.paragraphs)
        ? block.paragraphs.map(normalizeBlogParagraph).filter((item): item is BlogArticleParagraph => Boolean(item))
        : [];

    if (legacyHeading && legacyParagraphs.length > 0) {
      flushCurrent();
      sections.push({ heading: legacyHeading, paragraphs: legacyParagraphs });
      continue;
    }

    const type = "type" in block && typeof block.type === "string" ? block.type : "";
    const text = "text" in block && typeof block.text === "string" ? block.text.trim() : "";
    if (!text) continue;

    if (type === "heading") {
      flushCurrent();
      current = { heading: text, paragraphs: [] };
      continue;
    }

    if (type === "paragraph" && current) current.paragraphs.push(text);
  }

  flushCurrent();
  return sections;
}

export function parseEditorialParagraph(value: string): BlogArticleParagraph {
  const input = value.trim();
  const content: BlogInlineContent[] = [];
  let cursor = 0;
  for (const match of input.matchAll(EDITOR_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) content.push({ type: "text", text: input.slice(cursor, index) });
    content.push({ type: "link", text: match[1], href: match[2].trim() });
    cursor = index + match[0].length;
  }
  if (cursor === 0) return input;
  if (cursor < input.length) content.push({ type: "text", text: input.slice(cursor) });
  return { type: "rich_text", content };
}

export function serializeEditorialParagraph(paragraph: BlogArticleParagraph) {
  if (typeof paragraph === "string") return paragraph;
  return paragraph.content.map((item) => item.type === "link" ? `[${item.text}](${item.href})` : item.text).join("");
}

export function validateStructuredBlogLinks(sections: BlogArticleSection[]) {
  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      if (typeof paragraph === "string") continue;
      for (const item of paragraph.content) {
        if (item.type !== "link") continue;
        if (!item.text.trim()) return "BLOG_LINK_TEXT_REQUIRED";
        if (!isSafeBlogLinkHref(item.href)) return "BLOG_LINK_INVALID_HREF";
      }
    }
  }
  return null;
}
