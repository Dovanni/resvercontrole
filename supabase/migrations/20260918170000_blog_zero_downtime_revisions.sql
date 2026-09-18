-- VEJAMAIS ERP — Blog Editorial V2
-- Fase corretiva 4D — zero-downtime published revision + working revision
-- REPOSITORY-ONLY: não aplicar sem auditoria e autorização explícita.

begin;

alter table public.blog_posts
  add column if not exists published_revision_number integer;

alter table public.blog_posts
  add constraint blog_posts_published_revision_positive_check
  check (published_revision_number is null or published_revision_number > 0),
  add constraint blog_posts_published_revision_not_ahead_check
  check (published_revision_number is null or published_revision_number <= revision_number);

create table public.blog_post_revision_tags (
  post_id uuid not null,
  revision_number integer not null,
  tag_id uuid not null references public.blog_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, revision_number, tag_id),
  constraint blog_post_revision_tags_revision_fk
    foreign key (post_id, revision_number)
    references public.blog_post_revisions(post_id, revision_number)
    on delete cascade
);
create index blog_post_revision_tags_tag_idx
  on public.blog_post_revision_tags(tag_id, post_id, revision_number);

do $$
begin
  -- published_at histórico não implica publicação ativa. O bootstrap público
  -- considera exclusivamente o estado atual 'published'.
  if exists (
    select 1
    from public.blog_posts p
    where p.status = 'published'
      and not exists (
        select 1 from public.blog_post_revisions r
        where r.post_id = p.id and r.revision_number = p.revision_number
      )
  ) then
    raise exception 'BLOG_ZERO_DOWNTIME_BACKFILL_MISSING_PUBLISHED_SNAPSHOT';
  end if;
end;
$$;

update public.blog_posts
set published_revision_number = revision_number
where status = 'published';

insert into public.blog_post_revision_tags(post_id, revision_number, tag_id)
select p.id, p.revision_number, pt.tag_id
from public.blog_posts p
join public.blog_post_revisions r
  on r.post_id = p.id and r.revision_number = p.revision_number
join public.blog_post_tags pt on pt.post_id = p.id
on conflict do nothing;

alter table public.blog_posts
  add constraint blog_posts_published_revision_fk
  foreign key (id, published_revision_number)
  references public.blog_post_revisions(post_id, revision_number)
  on delete restrict;

create or replace function blog_private.guard_blog_publication_pointer()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
begin
  -- Fecha a janela de compatibilidade do frontend legado: depois desta
  -- migration, published -> review só pode ser iniciado pela RPC dedicada.
  if old.status = 'published' and new.status = 'review'
     and old.published_revision_number is not null
     and coalesce(current_setting('blog.revision_context', true), '') <> 'begin_post_revision' then
    raise exception 'BLOG_PUBLISHED_REVIEW_REQUIRES_BEGIN_REVISION_RPC';
  end if;

  -- Arquivar oculta a publicação no read model sem destruir o último ponteiro.
  if new.published_revision_number is distinct from old.published_revision_number then
    if old.status in ('review','scheduled')
       and new.status = 'published'
       and new.published_revision_number = new.revision_number then
      return new;
    end if;
    raise exception 'BLOG_PUBLISHED_REVISION_POINTER_WRITE_FORBIDDEN';
  end if;
  return new;
end;
$$;
revoke all on function blog_private.guard_blog_publication_pointer() from public;

create trigger blog_posts_15_guard_publication_pointer
before update on public.blog_posts
for each row execute function blog_private.guard_blog_publication_pointer();

create or replace function blog_private.capture_blog_post_revision_tags()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
begin
  insert into public.blog_post_revision_tags(post_id, revision_number, tag_id)
  select new.post_id, new.revision_number, pt.tag_id
  from public.blog_post_tags pt
  where pt.post_id = new.post_id
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function blog_private.capture_blog_post_revision_tags() from public;

create trigger blog_post_revisions_90_capture_tags
after insert on public.blog_post_revisions
for each row execute function blog_private.capture_blog_post_revision_tags();

create or replace function blog_private.sync_current_revision_tags()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _post_id uuid := coalesce(new.post_id, old.post_id);
  _revision integer;
begin
  select revision_number into _revision from public.blog_posts where id = _post_id;
  if _revision is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  delete from public.blog_post_revision_tags
  where post_id = _post_id and revision_number = _revision;

  insert into public.blog_post_revision_tags(post_id, revision_number, tag_id)
  select _post_id, _revision, pt.tag_id
  from public.blog_post_tags pt
  where pt.post_id = _post_id
  on conflict do nothing;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function blog_private.sync_current_revision_tags() from public;

create trigger blog_post_tags_90_sync_revision_tags
after insert or delete on public.blog_post_tags
for each row execute function blog_private.sync_current_revision_tags();

create or replace function public.blog_begin_post_revision(
  p_post_id uuid,
  p_expected_revision integer
)
returns table(post_id uuid, revision_number integer, status text, published_revision_number integer)
language plpgsql
security invoker
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _current public.blog_posts%rowtype;
  _next_revision integer;
begin
  if auth.uid() is null then raise exception 'BLOG_AUTH_REQUIRED'; end if;
  if not blog_private.has_editorial_role(array['owner','editor']) then
    raise exception 'BLOG_EDITORIAL_WRITE_FORBIDDEN';
  end if;

  select * into _current from public.blog_posts where id = p_post_id for update;
  if not found then raise exception 'BLOG_POST_NOT_FOUND'; end if;
  if _current.status <> 'published' then raise exception 'BLOG_PUBLISHED_STATUS_REQUIRED'; end if;
  if _current.published_revision_number is null then raise exception 'BLOG_PUBLISHED_REVISION_POINTER_REQUIRED'; end if;
  if _current.revision_number <> p_expected_revision then
    raise exception 'BLOG_EDITORIAL_REVISION_CONFLICT' using errcode = '40001';
  end if;

  _next_revision := _current.revision_number + 1;
  perform set_config('blog.revision_context', 'begin_post_revision', true);

  update public.blog_posts
  set status = 'review', revision_number = _next_revision, reviewed_by = null, scheduled_at = null
  where id = p_post_id and revision_number = p_expected_revision;

  update public.blog_posts
  set status = 'draft', reviewed_by = null, scheduled_at = null
  where id = p_post_id and revision_number = _next_revision;

  return query
  select p.id, p.revision_number, p.status, p.published_revision_number
  from public.blog_posts p where p.id = p_post_id;
end;
$$;
revoke all on function public.blog_begin_post_revision(uuid, integer) from public;
grant execute on function public.blog_begin_post_revision(uuid, integer) to authenticated;

create or replace function public.blog_public_list_posts()
returns table(
  id uuid, slug text, title text, excerpt text, content jsonb,
  published_at timestamptz, updated_at timestamptz, reading_time_minutes integer,
  meta_title text, meta_description text, focus_keyword text,
  featured_image_path text, featured_image_alt text,
  seo_allow_indexing boolean, seo_allow_following boolean, seo_include_in_sitemap boolean,
  category text, author text, tags text[], published_revision_number integer
)
language sql stable security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
  select
    p.id,
    r.snapshot->>'slug',
    r.snapshot->>'title',
    r.snapshot->>'excerpt',
    coalesce(r.snapshot->'content', '[]'::jsonb),
    p.published_at,
    (r.snapshot->>'updated_at')::timestamptz,
    coalesce((r.snapshot->>'reading_time_minutes')::integer, 1),
    r.snapshot->>'meta_title',
    r.snapshot->>'meta_description',
    r.snapshot->>'focus_keyword',
    r.snapshot->>'featured_image_path',
    r.snapshot->>'featured_image_alt',
    coalesce((r.snapshot->>'seo_allow_indexing')::boolean, true),
    coalesce((r.snapshot->>'seo_allow_following')::boolean, true),
    coalesce((r.snapshot->>'seo_include_in_sitemap')::boolean, true),
    coalesce(c.name, 'VEJAMAIS ERP'),
    coalesce(a.display_name, 'Equipe Editorial VEJAMAIS ERP'),
    coalesce(array_agg(t.name order by t.name) filter (where t.id is not null), '{}'::text[]),
    p.published_revision_number
  from public.blog_posts p
  join public.blog_post_revisions r
    on r.post_id = p.id and r.revision_number = p.published_revision_number
  left join public.blog_categories c on c.id = nullif(r.snapshot->>'category_id','')::uuid
  left join public.blog_authors a on a.id = nullif(r.snapshot->>'author_id','')::uuid
  left join public.blog_post_revision_tags rt
    on rt.post_id = p.id and rt.revision_number = p.published_revision_number
  left join public.blog_tags t on t.id = rt.tag_id
  where p.published_revision_number is not null
    and p.status <> 'archived'
    and p.published_at is not null
    and p.published_at <= now()
  group by p.id, r.id, c.name, a.display_name
  order by p.published_at desc;
$$;
revoke all on function public.blog_public_list_posts() from public;
grant execute on function public.blog_public_list_posts() to anon, authenticated;

create or replace function public.blog_public_get_post_by_slug(p_slug text)
returns table(
  id uuid, slug text, title text, excerpt text, content jsonb,
  published_at timestamptz, updated_at timestamptz, reading_time_minutes integer,
  meta_title text, meta_description text, focus_keyword text,
  featured_image_path text, featured_image_alt text,
  seo_allow_indexing boolean, seo_allow_following boolean, seo_include_in_sitemap boolean,
  category text, author text, tags text[], published_revision_number integer
)
language sql stable security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
  select p.* from public.blog_public_list_posts() p
  where p.slug = btrim(p_slug)
  limit 1;
$$;
revoke all on function public.blog_public_get_post_by_slug(text) from public;
grant execute on function public.blog_public_get_post_by_slug(text) to anon, authenticated;

-- Preflight de hardening para SECURITY DEFINER: nenhuma role de aplicação pode
-- possuir CREATE nos schemas resolvidos pelo search_path das funções públicas.
do $$
begin
  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE')
     or has_schema_privilege('anon', 'blog_private', 'CREATE')
     or has_schema_privilege('authenticated', 'blog_private', 'CREATE') then
    raise exception 'BLOG_SECURITY_DEFINER_SCHEMA_CREATE_PRIVILEGE_UNSAFE';
  end if;
end;
$$;

create or replace function public.blog_publish_working_revision(
  p_post_id uuid,
  p_expected_revision integer
)
returns table(post_id uuid, revision_number integer, status text, published_revision_number integer, published_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _post public.blog_posts%rowtype;
  _decision text;
  _reviewer uuid;
begin
  if auth.uid() is null then raise exception 'BLOG_AUTH_REQUIRED'; end if;
  if not blog_private.has_editorial_role(array['owner','editor']) then
    raise exception 'BLOG_EDITORIAL_WRITE_FORBIDDEN';
  end if;

  select * into _post from public.blog_posts where id = p_post_id for update;
  if not found then raise exception 'BLOG_POST_NOT_FOUND'; end if;
  if _post.revision_number <> p_expected_revision then
    raise exception 'BLOG_EDITORIAL_REVISION_CONFLICT' using errcode = '40001';
  end if;
  if _post.status not in ('review','scheduled') then raise exception 'BLOG_REVIEW_STATUS_REQUIRED'; end if;
  if _post.published_revision_number is not null and _post.published_revision_number >= _post.revision_number then
    raise exception 'BLOG_WORKING_REVISION_REQUIRED';
  end if;

  select r.decision, r.reviewer_user_id into _decision, _reviewer
  from public.blog_post_reviews r
  where r.post_id = _post.id and r.revision_number = _post.revision_number
  order by r.created_at desc, r.id desc limit 1;
  if _decision is distinct from 'approved' or _reviewer is null then
    raise exception 'BLOG_CURRENT_REVISION_REQUIRES_APPROVAL';
  end if;

  update public.blog_posts
  set status = 'published', published_revision_number = revision_number
  where id = _post.id and revision_number = _post.revision_number;

  return query
  select p.id, p.revision_number, p.status, p.published_revision_number, p.published_at
  from public.blog_posts p where p.id = _post.id;
end;
$$;
revoke all on function public.blog_publish_working_revision(uuid, integer) from public;
grant execute on function public.blog_publish_working_revision(uuid, integer) to authenticated;

-- O publicador agendado existente também deve promover o ponteiro público da
-- revisão corrente no mesmo UPDATE que muda scheduled -> published.
create or replace function blog_private.publish_due_scheduled_posts(p_limit integer default 50)
returns table(post_id uuid,outcome text,detail text,published_at timestamptz)
language plpgsql security definer
set search_path=pg_catalog,public,blog_private,pg_temp
as $$
declare _post record; _latest_review_decision text; _latest_reviewer uuid; _published_at timestamptz;
begin
 if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'BLOG_SCHEDULED_PUBLISHER_LIMIT_INVALID'; end if;
 perform set_config('blog.scheduler_context','scheduled_publisher',true);
 for _post in
  select p.id,p.slug,p.revision_number,p.published_revision_number,p.scheduled_at,p.category_id,p.author_id,p.meta_title,p.meta_description,p.content
  from public.blog_posts p
  where p.status='scheduled' and p.scheduled_at is not null and p.scheduled_at<=now()
  order by p.scheduled_at,p.id limit p_limit for update skip locked
 loop
  select r.decision,r.reviewer_user_id into _latest_review_decision,_latest_reviewer
  from public.blog_post_reviews r
  where r.post_id=_post.id and r.revision_number=_post.revision_number
  order by r.created_at desc,r.id desc limit 1;

  if _latest_review_decision is distinct from 'approved' or _latest_reviewer is null then
   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,error_code,detail)
   values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'skipped_no_approval','BLOG_CURRENT_REVISION_REQUIRES_APPROVAL','Revisão atual sem aprovação válida; nenhuma publicação executada.') on conflict do nothing;
   post_id:=_post.id; outcome:='skipped_no_approval'; detail:='BLOG_CURRENT_REVISION_REQUIRES_APPROVAL'; published_at:=null; return next; continue;
  end if;

  if _post.category_id is null or _post.author_id is null
     or nullif(btrim(coalesce(_post.meta_title,'')),'') is null
     or nullif(btrim(coalesce(_post.meta_description,'')),'') is null
     or jsonb_typeof(_post.content) is distinct from 'array'
     or jsonb_array_length(_post.content)=0 then
   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,error_code,detail)
   values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'skipped_requirements','BLOG_PUBLISHING_REQUIREMENTS_NOT_MET','Requisitos editoriais de publicação não atendidos; nenhuma publicação executada.') on conflict do nothing;
   post_id:=_post.id; outcome:='skipped_requirements'; detail:='BLOG_PUBLISHING_REQUIREMENTS_NOT_MET'; published_at:=null; return next; continue;
  end if;

  begin
   update public.blog_posts p
   set status='published', published_revision_number=p.revision_number
   where p.id=_post.id and p.status='scheduled' and p.scheduled_at is not null and p.scheduled_at<=now()
   returning p.published_at into _published_at;
   if not found then continue; end if;

   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,detail)
   values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'published','Publicação agendada promoveu atomicamente a revisão corrente para o ponteiro público.');
   post_id:=_post.id; outcome:='published'; detail:=null; published_at:=_published_at; return next;
  exception when others then
   insert into blog_private.blog_scheduled_publication_attempts(post_id,post_slug,revision_number,scheduled_at,outcome,error_code,detail)
   values(_post.id,_post.slug,_post.revision_number,_post.scheduled_at,'failed',sqlstate,left(sqlerrm,1000));
   post_id:=_post.id; outcome:='failed'; detail:=sqlstate||': '||left(sqlerrm,900); published_at:=null; return next;
  end;
 end loop;
end;
$$;
revoke all on function blog_private.publish_due_scheduled_posts(integer) from public,anon,authenticated,service_role;

alter table public.blog_post_revision_tags enable row level security;
create policy blog_post_revision_tags_editorial_read on public.blog_post_revision_tags
for select to authenticated
using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
revoke all on table public.blog_post_revision_tags from anon, authenticated;
grant select on table public.blog_post_revision_tags to authenticated;

commit;
