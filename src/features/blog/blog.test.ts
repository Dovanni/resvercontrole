import { describe, expect, it } from "vitest";
import { BLOG_ARTICLES } from "./articles";
import {
  getPreviewBlogArticleBySlug,
  getRelatedPreviewBlogArticles,
  listPreviewBlogArticles,
  mapPublishedBlogPost,
} from "./blog.repository";
import {
  articleToEditorialForm,
  availableEditorialCommands,
  planEditorialCommand,
  simulateEditorialCommand,
  validateEditorialPublishingRequirements,
} from "./editorial-workflow";

describe("Blog Editorial V2 repository-only contracts", () => {
  it("keeps the initial preview content local and available through the repository", () => {
    expect(BLOG_ARTICLES).toHaveLength(3);
    expect(listPreviewBlogArticles()).toBe(BLOG_ARTICLES);
  });

  it("uses unique, non-empty slugs", () => {
    const slugs = listPreviewBlogArticles().map((article) => article.slug);

    expect(slugs.every((slug) => slug.trim().length > 0)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps every preview article out of published state", () => {
    expect(listPreviewBlogArticles().every((article) => article.status !== "published")).toBe(true);
  });

  it("resolves an article by its canonical slug through the repository", () => {
    const article = listPreviewBlogArticles()[0];

    expect(getPreviewBlogArticleBySlug(article.slug)?.id).toBe(article.id);
  });

  it("returns undefined for an unknown preview slug", () => {
    expect(getPreviewBlogArticleBySlug("artigo-inexistente")).toBeUndefined();
  });

  it("keeps related preview articles isolated from the current article", () => {
    const article = listPreviewBlogArticles()[0];
    const related = getRelatedPreviewBlogArticles(article);

    expect(related).toHaveLength(2);
    expect(related.every((candidate) => candidate.slug !== article.slug)).toBe(true);
  });

  it("has complete editorial SEO metadata", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(article.metaTitle.trim().length).toBeGreaterThan(0);
      expect(article.metaDescription.trim().length).toBeGreaterThan(0);
      expect(article.focusKeyword.trim().length).toBeGreaterThan(0);
      expect(article.featuredImageAlt.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps metadata within practical preview limits", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(article.metaTitle.length).toBeLessThanOrEqual(65);
      expect(article.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it("uses valid preview dates and positive reading times", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(Number.isNaN(Date.parse(article.publishedAt))).toBe(false);
      expect(Number.isNaN(Date.parse(article.updatedAt))).toBe(false);
      expect(article.readingTimeMinutes).toBeGreaterThan(0);
    }
  });

  it("has structured sections, categories and tags for every preview article", () => {
    for (const article of listPreviewBlogArticles()) {
      expect(article.category.trim().length).toBeGreaterThan(0);
      expect(article.tags.length).toBeGreaterThan(0);
      expect(article.sections.length).toBeGreaterThan(0);
      expect(article.sections.every((section) => section.heading.trim().length > 0)).toBe(true);
      expect(article.sections.every((section) => section.paragraphs.length > 0)).toBe(true);
    }
  });

  it("maps a published database row to the homologated BlogArticle contract", () => {
    const article = mapPublishedBlogPost({
      id: "11111111-1111-4111-8111-111111111111",
      slug: "artigo-publicado",
      title: "Artigo publicado",
      excerpt: "Resumo editorial",
      content: [{ heading: "Seção", paragraphs: ["Parágrafo"] }],
      status: "published",
      published_at: "2026-09-02T12:00:00Z",
      updated_at: "2026-09-02T13:00:00Z",
      reading_time_minutes: 4,
      meta_title: "Artigo publicado | VEJAMAIS ERP",
      meta_description: "Descrição do artigo publicado.",
      focus_keyword: "artigo publicado",
      featured_image_path: null,
      featured_image_alt: "Imagem do artigo publicado",
      blog_categories: { name: "Gestão Empresarial" },
      blog_authors: { display_name: "Equipe Editorial VEJAMAIS ERP" },
      blog_post_tags: [{ blog_tags: { name: "gestão" } }],
    });

    expect(article.status).toBe("published");
    expect(article.category).toBe("Gestão Empresarial");
    expect(article.author).toBe("Equipe Editorial VEJAMAIS ERP");
    expect(article.tags).toEqual(["gestão"]);
    expect(article.sections).toEqual([{ heading: "Seção", paragraphs: ["Parágrafo"] }]);
  });

  it("rejects non-published rows in the public database mapper", () => {
    expect(() =>
      mapPublishedBlogPost({
        id: "22222222-2222-4222-8222-222222222222",
        slug: "draft",
        title: "Draft",
        excerpt: "Resumo",
        content: [],
        status: "draft",
        published_at: null,
        updated_at: "2026-09-02T13:00:00Z",
        reading_time_minutes: 1,
        meta_title: null,
        meta_description: null,
        focus_keyword: null,
        featured_image_path: null,
        featured_image_alt: null,
      }),
    ).toThrow("BLOG_REPOSITORY_EXPECTED_PUBLISHED_POST");
  });
});

describe("Fase 3-M repository-only editorial workflow", () => {
  const author = { userId: "author-user", role: "author" as const, authorId: "author-profile" };
  const editor = { userId: "editor-user", role: "editor" as const, authorId: null };
  const reviewer = { userId: "reviewer-user", role: "reviewer" as const, authorId: null };

  function draft(createdByUserId = author.userId) {
    return { ...articleToEditorialForm(listPreviewBlogArticles()[0]), createdByUserId };
  }

  it("keeps every command explicitly non-persistent", () => {
    const plan = planEditorialCommand(author, draft(), "submit_review");
    expect(plan.allowedByClientContract).toBe(true);
    expect(plan.persistence).toBe("disabled_repository_only");
    expect(plan.note).toContain("Nenhuma mutação Supabase");
  });

  it("allows an author to edit and submit only the author's own draft", () => {
    expect(availableEditorialCommands(author, draft())).toContain("submit_review");
    expect(availableEditorialCommands(author, draft("other-user"))).not.toContain("submit_review");
  });

  it("simulates draft to review without mutating the original form", () => {
    const original = draft();
    const plan = planEditorialCommand(author, original, "submit_review");
    const next = simulateEditorialCommand(original, plan);

    expect(original.status).toBe("draft");
    expect(next.status).toBe("review");
    expect(next).not.toBe(original);
  });

  it("enforces four-eyes review in the client contract", () => {
    const review = { ...draft(reviewer.userId), status: "review" as const };
    const plan = planEditorialCommand(reviewer, review, "approve_revision");

    expect(plan.allowedByClientContract).toBe(false);
    expect(plan.issues.some((current) => current.code === "BLOG_FOUR_EYES_SELF_REVIEW_FORBIDDEN")).toBe(true);
  });

  it("requires current approval before schedule or publish", () => {
    const review = { ...draft(), status: "review" as const };
    const plan = planEditorialCommand(editor, review, "publish");

    expect(plan.allowedByClientContract).toBe(false);
    expect(plan.issues.some((current) => current.code === "BLOG_CURRENT_REVISION_REQUIRES_APPROVAL")).toBe(true);
  });

  it("requires a future timestamp for scheduling", () => {
    const review = {
      ...draft(),
      status: "review" as const,
      latestReviewDecision: "approved" as const,
      latestReviewerUserId: reviewer.userId,
      scheduledAt: "2026-09-02T12:00:00-03:00",
    };
    const plan = planEditorialCommand(editor, review, "schedule", new Date("2026-09-02T15:00:00-03:00"));

    expect(plan.allowedByClientContract).toBe(false);
    expect(plan.issues.some((current) => current.code === "BLOG_SCHEDULE_MUST_BE_FUTURE")).toBe(true);
  });

  it("mirrors publishing requirements before a publish simulation", () => {
    const incomplete = {
      ...draft(),
      status: "review" as const,
      category: "",
      author: "",
      metaTitle: "",
      metaDescription: "",
      sections: [],
    };

    const codes = validateEditorialPublishingRequirements(incomplete).map((current) => current.code);
    expect(codes).toContain("BLOG_CATEGORY_REQUIRED");
    expect(codes).toContain("BLOG_AUTHOR_REQUIRED");
    expect(codes).toContain("BLOG_META_TITLE_REQUIRED");
    expect(codes).toContain("BLOG_META_DESCRIPTION_REQUIRED");
    expect(codes).toContain("BLOG_CONTENT_REQUIRED");
  });

  it("allows owner/editor archive and restore transitions while authors cannot", () => {
    const published = { ...draft(), status: "published" as const };
    const archived = { ...draft(), status: "archived" as const };

    expect(availableEditorialCommands(editor, published)).toContain("archive");
    expect(availableEditorialCommands(editor, archived)).toContain("restore_draft");
    expect(availableEditorialCommands(author, published)).not.toContain("archive");
  });
});
