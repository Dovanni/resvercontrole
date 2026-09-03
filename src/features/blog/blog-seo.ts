import type { BlogArticle } from "./types";

export const BLOG_PUBLIC_ORIGIN = "https://vejamais.com.br";
export const BLOG_PUBLIC_PATH = "/blog";
export const BLOG_SITEMAP_PATH = "/sitemap-blog.xml";
export const BLOG_SITEMAP_URL = `${BLOG_PUBLIC_ORIGIN}${BLOG_SITEMAP_PATH}`;

export function blogCanonicalUrl(slug?: string) {
  return slug ? `${BLOG_PUBLIC_ORIGIN}${BLOG_PUBLIC_PATH}/${encodeURIComponent(slug)}` : `${BLOG_PUBLIC_ORIGIN}${BLOG_PUBLIC_PATH}`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildBlogPostingJsonLd(article: BlogArticle) {
  const canonical = blogCanonicalUrl(article.slug);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Organization", name: article.author },
    publisher: { "@type": "Organization", name: "VEJAMAIS ERP", url: BLOG_PUBLIC_ORIGIN },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    url: canonical,
    keywords: [article.focusKeyword, ...article.tags].filter(Boolean).join(", "),
    ...(article.featuredImage ? { image: [article.featuredImage] } : {}),
  };
}

export function buildBlogBreadcrumbJsonLd(article: BlogArticle) {
  const canonical = blogCanonicalUrl(article.slug);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${BLOG_PUBLIC_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: blogCanonicalUrl() },
      { "@type": "ListItem", position: 3, name: article.title, item: canonical },
    ],
  };
}

export function buildBlogIndexHead() {
  const canonical = blogCanonicalUrl();
  return {
    meta: [
      { title: "Blog VEJAMAIS ERP | Gestão empresarial na prática" },
      { name: "description", content: "Guias práticos sobre fluxo de caixa, estoque, vendas, operações e gestão empresarial no Blog VEJAMAIS ERP." },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: "Blog VEJAMAIS ERP | Gestão empresarial na prática" },
      { property: "og:description", content: "Conteúdo editorial para ajudar empresas a organizar finanças, estoque, processos e decisões de gestão." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:site_name", content: "VEJAMAIS ERP" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

export function buildPublishedArticleHead(article: BlogArticle) {
  const canonical = blogCanonicalUrl(article.slug);
  return {
    meta: [
      { title: article.metaTitle },
      { name: "description", content: article.metaDescription },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: article.metaTitle },
      { property: "og:description", content: article.metaDescription },
      { property: "og:type", content: "article" },
      { property: "og:url", content: canonical },
      { property: "og:site_name", content: "VEJAMAIS ERP" },
      { property: "article:published_time", content: article.publishedAt },
      { property: "article:modified_time", content: article.updatedAt },
      ...(article.featuredImage ? [{ property: "og:image", content: article.featuredImage }, { property: "og:image:alt", content: article.featuredImageAlt }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: article.metaTitle },
      { name: "twitter:description", content: article.metaDescription },
      ...(article.featuredImage ? [{ name: "twitter:image", content: article.featuredImage }] : []),
    ],
    links: [{ rel: "canonical", href: canonical }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(buildBlogPostingJsonLd(article)) },
      { type: "application/ld+json", children: JSON.stringify(buildBlogBreadcrumbJsonLd(article)) },
    ],
  };
}

/**
 * This builder receives only the already-filtered published read model.
 * Draft/review/scheduled content must never be passed to it.
 */
export function buildBlogSitemapXml(articles: BlogArticle[]) {
  const urls = [
    `<url><loc>${escapeXml(blogCanonicalUrl())}</loc></url>`,
    ...articles.map(
      (article) =>
        `<url><loc>${escapeXml(blogCanonicalUrl(article.slug))}</loc><lastmod>${escapeXml(new Date(article.updatedAt).toISOString())}</lastmod></url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}

/**
 * Proposal only. Do not publish this as /robots.txt until the historical/live
 * robots contract has been explicitly reconciled. Keeping it here lets the
 * future change be reviewed without replacing unknown legacy directives.
 */
export function buildBlogRobotsTxtProposal(existingRobotsText: string) {
  const normalized = existingRobotsText.trimEnd();
  if (normalized.includes(BLOG_SITEMAP_URL)) return `${normalized}\n`;
  return `${normalized}${normalized ? "\n\n" : ""}Sitemap: ${BLOG_SITEMAP_URL}\n`;
}
