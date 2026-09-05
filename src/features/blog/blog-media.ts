import { blogSupabase } from "./blog-supabase";

export const BLOG_MEDIA_BUCKET = "blog-media";
export const BLOG_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const BLOG_MEDIA_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

type AllowedBlogMediaMimeType = (typeof BLOG_MEDIA_ALLOWED_MIME_TYPES)[number];

export interface BlogMediaValidationResult {
  ok: boolean;
  error?: string;
}

export function validateFeaturedImageFile(file: Pick<File, "size" | "type">): BlogMediaValidationResult {
  if (!BLOG_MEDIA_ALLOWED_MIME_TYPES.includes(file.type as AllowedBlogMediaMimeType)) {
    return { ok: false, error: "Use uma imagem JPEG, PNG, WebP ou AVIF." };
  }
  if (file.size <= 0) return { ok: false, error: "O arquivo de imagem está vazio." };
  if (file.size > BLOG_MEDIA_MAX_BYTES) return { ok: false, error: "A imagem deve ter no máximo 5 MB." };
  return { ok: true };
}

export function buildFeaturedImageObjectPath(postId: string, fileName: string, now = Date.now()) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeName = normalized || "imagem";
  return `posts/${postId}/${now}-${safeName}`;
}

export function getBlogMediaPublicUrl(path: string) {
  if (!path) return "";
  return blogSupabase.storage.from(BLOG_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadFeaturedImage(postId: string, file: File) {
  const validation = validateFeaturedImageFile(file);
  if (!validation.ok) throw new Error(validation.error);
  if (!postId) throw new Error("Salve o draft antes de enviar uma imagem destacada.");

  const path = buildFeaturedImageObjectPath(postId, file.name);
  const { error } = await blogSupabase.storage.from(BLOG_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return { path, publicUrl: getBlogMediaPublicUrl(path) };
}
