-- VEJAMAIS ERP — Blog Editorial V2
-- Fase 3-I.3 — Rollback manual e conservador validado em laboratório
-- NÃO é migration automática. Executar somente mediante autorização explícita.
-- PRÉ-CONDIÇÃO OBRIGATÓRIA: remover primeiro TODOS os arquivos e o bucket
-- `blog-media` pela Storage API / Dashboard do Supabase. O Supabase bloqueia
-- DELETE direto em storage.buckets por SQL para evitar objetos órfãos.

begin;

-- 1. Abortar antes de qualquer DDL se o bucket ainda existir.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'blog-media') then
    raise exception 'BLOG_ROLLBACK_STORAGE_BUCKET_STILL_EXISTS: remova o bucket blog-media pela Storage API antes do rollback SQL';
  end if;
end;
$$;

-- 2. Remover policies de Storage criadas exclusivamente pelo Blog.
drop policy if exists blog_media_public_metadata_read on storage.objects;
drop policy if exists blog_media_editorial_insert on storage.objects;
drop policy if exists blog_media_editorial_update on storage.objects;
drop policy if exists blog_media_editorial_delete on storage.objects;

-- 3. Remover tabelas filhas antes das tabelas-pai.
drop table if exists public.blog_post_reviews;
drop table if exists public.blog_workflow_events;
drop table if exists public.blog_post_revisions;
drop table if exists public.blog_post_tags;
drop table if exists public.blog_posts;
drop table if exists public.blog_editorial_members;
drop table if exists public.blog_authors;
drop table if exists public.blog_tags;
drop table if exists public.blog_categories;

-- 4. Remover somente as funções privadas introduzidas pelo módulo editorial.
drop function if exists blog_private.capture_blog_workflow_event();
drop function if exists blog_private.capture_blog_post_revision();
drop function if exists blog_private.guard_blog_review_insert();
drop function if exists blog_private.guard_blog_post_write();
drop function if exists blog_private.can_manage_media(text);
drop function if exists blog_private.can_edit_post(uuid);
drop function if exists blog_private.has_editorial_role(text[]);

-- 5. Remover o schema privado do Blog. public.set_updated_at() NÃO é removida,
-- porque pertence à matriz e já existia antes do módulo editorial.
drop schema if exists blog_private;

commit;
