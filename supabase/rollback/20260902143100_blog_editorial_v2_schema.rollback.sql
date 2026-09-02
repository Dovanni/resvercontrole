-- VEJAMAIS ERP — Blog Editorial V2
-- Fase 3-I.2 — Rollback manual e conservador
-- NÃO é migration automática. Executar somente mediante autorização explícita.
-- Pré-condição: o bucket blog-media deve estar vazio. Arquivos devem ser removidos
-- pela API de Storage antes deste rollback para evitar blobs órfãos.

begin;

-- 1. Remover policies de Storage criadas exclusivamente pelo Blog.
drop policy if exists blog_media_public_metadata_read on storage.objects;
drop policy if exists blog_media_editorial_insert on storage.objects;
drop policy if exists blog_media_editorial_update on storage.objects;
drop policy if exists blog_media_editorial_delete on storage.objects;

-- 2. Recusar rollback se ainda houver objetos no bucket.
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'blog-media') then
    raise exception 'BLOG_ROLLBACK_BUCKET_NOT_EMPTY: remova os arquivos pela Storage API antes do rollback';
  end if;
end;
$$;

-- 3. Remover somente o bucket editorial.
delete from storage.buckets where id = 'blog-media';

-- 4. Remover tabelas filhas antes das tabelas-pai.
drop table if exists public.blog_post_reviews;
drop table if exists public.blog_workflow_events;
drop table if exists public.blog_post_revisions;
drop table if exists public.blog_post_tags;
drop table if exists public.blog_posts;
drop table if exists public.blog_editorial_members;
drop table if exists public.blog_authors;
drop table if exists public.blog_tags;
drop table if exists public.blog_categories;

-- 5. Remover somente as funções privadas introduzidas pelo módulo editorial.
drop function if exists blog_private.capture_blog_workflow_event();
drop function if exists blog_private.capture_blog_post_revision();
drop function if exists blog_private.guard_blog_review_insert();
drop function if exists blog_private.guard_blog_post_write();
drop function if exists blog_private.can_manage_media(text);
drop function if exists blog_private.can_edit_post(uuid);
drop function if exists blog_private.has_editorial_role(text[]);

-- 6. Remover o schema privado do Blog. public.set_updated_at() NÃO é removida,
-- porque já existia antes do módulo editorial e pertence à matriz.
drop schema if exists blog_private;

commit;
