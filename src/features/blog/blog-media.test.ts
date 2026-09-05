import { describe, expect, it } from "vitest";
import {
  BLOG_MEDIA_MAX_BYTES,
  buildFeaturedImageObjectPath,
  validateFeaturedImageFile,
} from "./blog-media";

describe("Blog featured image media helper", () => {
  it("accepts supported image formats within the 5 MB limit", () => {
    expect(validateFeaturedImageFile({ type: "image/webp", size: BLOG_MEDIA_MAX_BYTES })).toEqual({ ok: true });
  });

  it("rejects unsupported formats and oversized files", () => {
    expect(validateFeaturedImageFile({ type: "image/gif", size: 1024 }).ok).toBe(false);
    expect(validateFeaturedImageFile({ type: "image/jpeg", size: BLOG_MEDIA_MAX_BYTES + 1 }).ok).toBe(false);
  });

  it("builds a post-scoped, SEO-friendly storage object path", () => {
    expect(
      buildFeaturedImageObjectPath(
        "11111111-1111-4111-8111-111111111111",
        "Fluxo de Caixa Empresa 2026.webp",
        123456789,
      ),
    ).toBe("posts/11111111-1111-4111-8111-111111111111/123456789-fluxo-de-caixa-empresa-2026.webp");
  });
});
