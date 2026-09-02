import { createFileRoute } from "@tanstack/react-router";
import { listPublishedBlogArticles } from "@/features/blog/blog.repository";
import { buildBlogSitemapXml } from "@/features/blog/blog-seo";

export const Route = createFileRoute("/sitemap-blog.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const articles = await listPublishedBlogArticles();
          const xml = buildBlogSitemapXml(articles);

          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
              "X-Content-Type-Options": "nosniff",
              "X-Robots-Tag": "noindex",
            },
          });
        } catch {
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Robots-Tag": "noindex, nofollow",
            },
          });
        }
      },
    },
  },
});
