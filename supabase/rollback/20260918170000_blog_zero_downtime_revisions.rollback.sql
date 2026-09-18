-- VEJAMAIS ERP — rollback Fase corretiva 4D zero-downtime revisions
-- REPOSITORY-ONLY. Aborta se houver revisão de trabalho separada da publicação.

begin;

do $$
begin
  if exists (
    select 1 from public.blog_posts p
    where p.published_revision_number is not null
      and (p.status <> 'published' or p.published_revision_number <> p.revision_number)
  ) then
    raise exception 'BLOG_ZERO_DOWNTIME_ROLLBACK_BLOCKED_WORKING_REVISION_EXISTS';
  end if;

  if exists (
    select 1
    from public.blog_posts p
    where p.published_revision_number is not null
      and not exists (
        select 1
        from public.blog_post_revisions r
        where r.post_id = p.id
          and r.revision_number = p.published_revision_number
          and r.snapshot->>'slug' = p.slug
          and r.snapshot->>'title' = p.title
          and coalesce(r.snapshot->'content', '[]'::jsonb) = p.content
      )
  ) then
    raise exception 'BLOG_ZERO_DOWNTIME_ROLLBACK_BLOCKED_SNAPSHOT_MISMATCH';
  end if;
end;
$$;

drop function if exists public.blog_publish_working_revision(uuid, integer);
drop function if exists public.blog_begin_post_revision(uuid, integer);
drop function if exists public.blog_public_get_post_by_slug(text);
drop function if exists public.blog_public_list_posts();

drop trigger if exists blog_post_tags_90_sync_revision_tags on public.blog_post_tags;
drop function if exists blog_private.sync_current_revision_tags();
drop trigger if exists blog_post_revisions_90_capture_tags on public.blog_post_revisions;
drop function if exists blog_private.capture_blog_post_revision_tags();
drop trigger if exists blog_posts_15_guard_publication_pointer on public.blog_posts;
drop function if exists blog_private.guard_blog_publication_pointer();

drop table if exists public.blog_post_revision_tags;

alter table public.blog_posts drop constraint if exists blog_posts_published_revision_fk;
alter table public.blog_posts drop constraint if exists blog_posts_published_revision_not_ahead_check;
alter table public.blog_posts drop constraint if exists blog_posts_published_revision_positive_check;
alter table public.blog_posts drop column if exists published_revision_number;

commit;
