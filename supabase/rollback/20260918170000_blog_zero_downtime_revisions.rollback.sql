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

-- Restaura exatamente o publicador agendado anterior à Fase 4D.
create or replace function blog_private.publish_due_scheduled_posts(p_limit integer default 50)
returns table(post_id uuid,outcome text,detail text,published_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,blog_private,pg_temp as $
declare _post record; _latest_review_decision text; _latest_reviewer uuid; _published_at timestamptz;
begin
 if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'BLOG_SCHEDULED_PUBLISHER_LIMIT_INVALID'; end if;
 perform set_config('blog.scheduler_context','scheduled_publisher',true);
 for _post in select p.id,p.slug,p.revision_number,p.scheduled_at,p.category_id,p.author_id,p.meta_title,p.meta_description,p.content from public.blog_posts p where p.status='scheduled' and p.scheduled_at is not null and p.scheduled_at<=now() order by p.scheduled_at,p.id limit p_limit for update skip locked loop
  select r.decision,r.reviewer_user_id into _latest_review_decision,_latest_reviewer from public.blog_post_reviews r where r.post_id=_post.id and r.revision_number=_post.revision_number order by r.created_at desc,r.id desc limit 1;
  if _latest_review_decision is distinct from 'approved' or _latest_reviewer is null then
   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,error_code,detail)
   values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'skipped_no_approval','BLOG_CURRENT_REVISION_REQUIRES_APPROVAL','Revisão atual sem aprovação válida; nenhuma publicação executada.') on conflict do nothing;
   post_id:=_post.id; outcome:='skipped_no_approval'; detail:='BLOG_CURRENT_REVISION_REQUIRES_APPROVAL'; published_at:=null; return next; continue;
  end if;
  if _post.category_id is null or _post.author_id is null or nullif(btrim(coalesce(_post.meta_title,'')),'') is null or nullif(btrim(coalesce(_post.meta_description,'')),'') is null or jsonb_typeof(_post.content) is distinct from 'array' or jsonb_array_length(_post.content)=0 then
   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,error_code,detail)
   values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'skipped_requirements','BLOG_PUBLISHING_REQUIREMENTS_NOT_MET','Requisitos editoriais de publicação não atendidos; nenhuma publicação executada.') on conflict do nothing;
   post_id:=_post.id; outcome:='skipped_requirements'; detail:='BLOG_PUBLISHING_REQUIREMENTS_NOT_MET'; published_at:=null; return next; continue;
  end if;
  begin
   update public.blog_posts p set status='published' where p.id=_post.id and p.status='scheduled' and p.scheduled_at is not null and p.scheduled_at<=now() returning p.published_at into _published_at;
   if not found then continue; end if;
   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,detail) values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'published','Publicação agendada promovida de scheduled para published.');
   post_id:=_post.id; outcome:='published'; detail:=null; published_at:=_published_at; return next;
  exception when others then
   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,error_code,detail) values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'failed',sqlstate,left(sqlerrm,1000));
   post_id:=_post.id; outcome:='failed'; detail:=sqlstate||': '||left(sqlerrm,900); published_at:=null; return next;
  end;
 end loop;
end; $;
revoke all on function blog_private.publish_due_scheduled_posts(integer) from public,anon,authenticated,service_role;

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
