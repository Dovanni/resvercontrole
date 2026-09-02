-- VEJAMAIS ERP — Blog Editorial V2
-- Fase 3-U.2 — correção encontrada na validação executável
-- Qualifica blog_post_tags.post_id para evitar colisão com o OUT parameter post_id.

begin;

create or replace function public.blog_save_draft_transaction(
  p_operation text,
  p_post_id uuid,
  p_expected_revision integer,
  p_slug text,
  p_title text,
  p_excerpt text,
  p_content jsonb,
  p_category_id uuid,
  p_author_id uuid,
  p_tag_ids uuid[],
  p_featured_image_path text,
  p_featured_image_alt text,
  p_meta_title text,
  p_meta_description text,
  p_focus_keyword text,
  p_reading_time_minutes integer
)
returns table(post_id uuid, revision_number integer, status text)
language plpgsql
security invoker
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _current_status text;
  _current_revision integer;
  _current_tags uuid[] := '{}'::uuid[];
  _desired_tags uuid[] := '{}'::uuid[];
  _tags_changed boolean := false;
  _result_id uuid;
  _result_revision integer;
  _result_status text;
begin
  if _uid is null then
    raise exception 'BLOG_AUTH_REQUIRED';
  end if;

  if p_operation not in ('create','update') then
    raise exception 'BLOG_DRAFT_RPC_OPERATION_INVALID';
  end if;

  if p_category_id is null or not exists (
    select 1 from public.blog_categories c where c.id = p_category_id and c.is_active = true
  ) then
    raise exception 'BLOG_CATEGORY_REFERENCE_NOT_FOUND';
  end if;

  if p_author_id is null or not exists (
    select 1 from public.blog_authors a where a.id = p_author_id and a.is_active = true
  ) then
    raise exception 'BLOG_AUTHOR_REFERENCE_NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct x.tag_id order by x.tag_id), '{}'::uuid[])
    into _desired_tags
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as x(tag_id);

  if exists (
    select 1
    from unnest(_desired_tags) as requested(tag_id)
    left join public.blog_tags t on t.id = requested.tag_id and t.is_active = true
    where t.id is null
  ) then
    raise exception 'BLOG_TAG_REFERENCE_NOT_FOUND';
  end if;

  if p_operation = 'create' then
    if p_post_id is not null or p_expected_revision is not null then
      raise exception 'BLOG_DRAFT_RPC_CREATE_TARGET_INVALID';
    end if;

    insert into public.blog_posts (
      slug, title, excerpt, content, category_id, author_id, status,
      featured_image_path, featured_image_alt, meta_title, meta_description,
      focus_keyword, reading_time_minutes
    ) values (
      p_slug, p_title, p_excerpt, p_content, p_category_id, p_author_id, 'draft',
      nullif(p_featured_image_path, ''), nullif(p_featured_image_alt, ''),
      nullif(p_meta_title, ''), nullif(p_meta_description, ''),
      nullif(p_focus_keyword, ''), p_reading_time_minutes
    )
    returning id, blog_posts.revision_number, blog_posts.status
      into _result_id, _result_revision, _result_status;

    insert into public.blog_post_tags (post_id, tag_id)
    select _result_id, tag_id from unnest(_desired_tags) as tags(tag_id);

    return query select _result_id, _result_revision, _result_status;
    return;
  end if;

  if p_post_id is null or p_expected_revision is null or p_expected_revision <= 0 then
    raise exception 'BLOG_DRAFT_RPC_UPDATE_TARGET_INVALID';
  end if;

  select p.status, p.revision_number
    into _current_status, _current_revision
  from public.blog_posts p
  where p.id = p_post_id
  for update;

  if not found then
    raise exception 'BLOG_POST_NOT_FOUND';
  end if;
  if _current_status <> 'draft' then
    raise exception 'BLOG_DRAFT_RPC_REQUIRES_DRAFT_STATUS';
  end if;
  if _current_revision <> p_expected_revision then
    raise exception 'BLOG_EDITORIAL_REVISION_CONFLICT' using errcode = '40001';
  end if;

  select coalesce(array_agg(pt.tag_id order by pt.tag_id), '{}'::uuid[])
    into _current_tags
  from public.blog_post_tags pt
  where pt.post_id = p_post_id;

  _tags_changed := _current_tags is distinct from _desired_tags;

  update public.blog_posts p
  set
    slug = p_slug,
    title = p_title,
    excerpt = p_excerpt,
    content = p_content,
    category_id = p_category_id,
    author_id = p_author_id,
    status = 'draft',
    revision_number = case when _tags_changed then p_expected_revision + 1 else p_expected_revision end,
    featured_image_path = nullif(p_featured_image_path, ''),
    featured_image_alt = nullif(p_featured_image_alt, ''),
    meta_title = nullif(p_meta_title, ''),
    meta_description = nullif(p_meta_description, ''),
    focus_keyword = nullif(p_focus_keyword, ''),
    reading_time_minutes = p_reading_time_minutes
  where p.id = p_post_id and p.revision_number = p_expected_revision
  returning p.id, p.revision_number, p.status
    into _result_id, _result_revision, _result_status;

  if not found then
    raise exception 'BLOG_EDITORIAL_REVISION_CONFLICT' using errcode = '40001';
  end if;

  if _tags_changed then
    delete from public.blog_post_tags pt where pt.post_id = p_post_id;
    insert into public.blog_post_tags (post_id, tag_id)
    select p_post_id, tag_id from unnest(_desired_tags) as tags(tag_id);
  end if;

  return query select _result_id, _result_revision, _result_status;
end;
$$;

revoke all on function public.blog_save_draft_transaction(
  text, uuid, integer, text, text, text, jsonb, uuid, uuid, uuid[],
  text, text, text, text, text, integer
) from public;
grant execute on function public.blog_save_draft_transaction(
  text, uuid, integer, text, text, text, jsonb, uuid, uuid, uuid[],
  text, text, text, text, text, integer
) to authenticated;

commit;
