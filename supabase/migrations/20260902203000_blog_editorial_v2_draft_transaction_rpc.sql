-- VEJAMAIS ERP — Blog Editorial V2
-- Fase 3-U.1 — RPC Transacional de Drafts (repository-only)
-- NÃO aplicar sem validação executável e autorização explícita.

begin;

-- O guard passa a reconhecer um bump explícito de revision_number como mudança
-- material. A RPC usa esse sinal somente quando o conjunto de tags muda sem
-- alteração dos demais campos, garantindo concorrência otimista também para
-- edições exclusivamente de tags.
create or replace function blog_private.guard_blog_post_write()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _owner_or_editor boolean := false;
  _is_author boolean := false;
  _author_own boolean := false;
  _member_author_id uuid;
  _content_changed boolean := false;
  _latest_review_decision text;
  _latest_reviewer uuid;
begin
  if _uid is not null then
    _owner_or_editor := blog_private.has_editorial_role(array['owner','editor']);
    _is_author := blog_private.has_editorial_role(array['author']);
    if _is_author then
      select m.author_id into _member_author_id
      from public.blog_editorial_members m
      where m.user_id = _uid and m.active = true and m.role = 'author';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if _uid is not null then
      new.created_by := _uid;
      new.updated_by := _uid;
      new.revision_number := 1;
      new.reviewed_by := null;
      new.published_by := null;
      new.published_at := null;
      new.scheduled_at := null;
      if new.status <> 'draft' then raise exception 'BLOG_INITIAL_STATUS_MUST_BE_DRAFT'; end if;
      if not (_owner_or_editor or _is_author) then raise exception 'BLOG_EDITORIAL_WRITE_FORBIDDEN'; end if;
      if _is_author and not _owner_or_editor then
        if _member_author_id is null then raise exception 'BLOG_AUTHOR_PROFILE_REQUIRED'; end if;
        if new.author_id is distinct from _member_author_id then raise exception 'BLOG_AUTHOR_ID_MUST_MATCH_EDITORIAL_MEMBER'; end if;
      end if;
    end if;
    return new;
  end if;

  if _uid is not null then
    new.created_by := old.created_by;
    new.updated_by := _uid;
    new.published_by := old.published_by;
    new.reviewed_by := old.reviewed_by;
    _author_own := _is_author and old.created_by = _uid;

    if _author_own and not _owner_or_editor then
      if _member_author_id is null then raise exception 'BLOG_AUTHOR_PROFILE_REQUIRED'; end if;
      if new.author_id is distinct from _member_author_id then raise exception 'BLOG_AUTHOR_ID_MUST_MATCH_EDITORIAL_MEMBER'; end if;
    end if;

    _content_changed := new.revision_number is distinct from old.revision_number
      or new.slug is distinct from old.slug
      or new.title is distinct from old.title
      or new.excerpt is distinct from old.excerpt
      or new.content is distinct from old.content
      or new.category_id is distinct from old.category_id
      or new.author_id is distinct from old.author_id
      or new.featured_image_path is distinct from old.featured_image_path
      or new.featured_image_alt is distinct from old.featured_image_alt
      or new.meta_title is distinct from old.meta_title
      or new.meta_description is distinct from old.meta_description
      or new.focus_keyword is distinct from old.focus_keyword
      or new.reading_time_minutes is distinct from old.reading_time_minutes;

    if _content_changed then
      new.revision_number := old.revision_number + 1;
      new.reviewed_by := null;
    else
      new.revision_number := old.revision_number;
    end if;

    if old.status = new.status then
      if _owner_or_editor and old.status in ('draft','review') then null;
      elsif _owner_or_editor and old.status = 'scheduled' and not _content_changed then null;
      elsif _author_own and old.status = 'draft' then null;
      else raise exception 'BLOG_EDITORIAL_WRITE_FORBIDDEN'; end if;
    else
      case old.status
        when 'draft' then
          if new.status = 'review' and (_owner_or_editor or _author_own) then null;
          elsif new.status = 'archived' and _owner_or_editor then null;
          else raise exception 'BLOG_INVALID_STATUS_TRANSITION: % -> %', old.status, new.status; end if;
        when 'review' then
          if new.status in ('draft','archived') and _owner_or_editor then null;
          elsif new.status in ('scheduled','published') and _owner_or_editor then
            select r.decision, r.reviewer_user_id
              into _latest_review_decision, _latest_reviewer
            from public.blog_post_reviews r
            where r.post_id = old.id and r.revision_number = new.revision_number
            order by r.created_at desc, r.id desc
            limit 1;
            if _latest_review_decision is distinct from 'approved' or _latest_reviewer is null then
              raise exception 'BLOG_CURRENT_REVISION_REQUIRES_APPROVAL';
            end if;
            new.reviewed_by := _latest_reviewer;
          else raise exception 'BLOG_INVALID_STATUS_TRANSITION: % -> %', old.status, new.status; end if;
        when 'scheduled' then
          if new.status in ('review','archived') and _owner_or_editor then null;
          elsif new.status = 'published' and _owner_or_editor then
            if old.scheduled_at is null or now() < old.scheduled_at then
              raise exception 'BLOG_SCHEDULED_PUBLICATION_NOT_DUE';
            end if;
            select r.decision, r.reviewer_user_id
              into _latest_review_decision, _latest_reviewer
            from public.blog_post_reviews r
            where r.post_id = old.id and r.revision_number = new.revision_number
            order by r.created_at desc, r.id desc
            limit 1;
            if _latest_review_decision is distinct from 'approved' or _latest_reviewer is null then
              raise exception 'BLOG_CURRENT_REVISION_REQUIRES_APPROVAL';
            end if;
            new.reviewed_by := _latest_reviewer;
          else raise exception 'BLOG_INVALID_STATUS_TRANSITION: % -> %', old.status, new.status; end if;
        when 'published' then
          if new.status in ('review','archived') and _owner_or_editor then null;
          else raise exception 'BLOG_INVALID_STATUS_TRANSITION: % -> %', old.status, new.status; end if;
        when 'archived' then
          if new.status = 'draft' and _owner_or_editor then null;
          else raise exception 'BLOG_INVALID_STATUS_TRANSITION: % -> %', old.status, new.status; end if;
        else raise exception 'BLOG_UNKNOWN_STATUS: %', old.status;
      end case;
    end if;
  end if;

  if old.status = 'published' and new.status = 'published' and _content_changed then
    raise exception 'BLOG_PUBLISHED_CONTENT_REQUIRES_REVIEW_TRANSITION';
  end if;

  if new.status = 'scheduled' then
    if new.scheduled_at is null then raise exception 'BLOG_SCHEDULE_REQUIRES_SCHEDULED_AT'; end if;
    if _uid is not null and new.scheduled_at <= now() then raise exception 'BLOG_SCHEDULE_MUST_BE_FUTURE'; end if;
  elsif old.status = 'scheduled' and new.status = 'review' then
    new.scheduled_at := null;
  end if;

  if new.status = 'published' then
    if new.category_id is null or new.author_id is null
       or nullif(btrim(coalesce(new.meta_title, '')), '') is null
       or nullif(btrim(coalesce(new.meta_description, '')), '') is null
       or jsonb_array_length(new.content) = 0 then
      raise exception 'BLOG_PUBLISHING_REQUIREMENTS_NOT_MET';
    end if;
    new.published_at := coalesce(old.published_at, new.published_at, now());
    if _uid is not null then new.published_by := _uid; end if;
  end if;

  return new;
end;
$$;
revoke all on function blog_private.guard_blog_post_write() from public;

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
    delete from public.blog_post_tags where post_id = p_post_id;
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
