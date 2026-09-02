-- VEJAMAIS ERP — Blog Editorial V2
-- Fase 3-I — Hardening complementar da migration repository-only
-- IMPORTANTE: NÃO APLICAR ao Supabase sem auditoria e autorização explícita.

begin;

create or replace function blog_private.can_edit_post(_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.blog_posts p
       where p.id = _post_id
         and (
           (p.status <> 'published' and blog_private.has_editorial_role(array['owner','editor']))
           or (p.status = 'draft' and p.created_by = auth.uid() and blog_private.has_editorial_role(array['author']))
         )
     );
$$;
revoke all on function blog_private.can_edit_post(uuid) from public;
grant execute on function blog_private.can_edit_post(uuid) to authenticated;

create or replace function blog_private.guard_blog_post_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _owner_or_editor boolean := false;
  _is_author boolean := false;
  _author_own boolean := false;
  _member_author_id uuid;
  _content_changed boolean := false;
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

    if old.status = new.status then
      if _owner_or_editor then null;
      elsif _author_own and old.status = 'draft' then null;
      else raise exception 'BLOG_EDITORIAL_WRITE_FORBIDDEN'; end if;
    else
      case old.status
        when 'draft' then
          if new.status = 'review' and (_owner_or_editor or _author_own) then null;
          elsif new.status = 'archived' and _owner_or_editor then null;
          else raise exception 'BLOG_INVALID_STATUS_TRANSITION: % -> %', old.status, new.status; end if;
        when 'review' then
          if new.status in ('draft','scheduled','published','archived') and _owner_or_editor then null;
          else raise exception 'BLOG_INVALID_STATUS_TRANSITION: % -> %', old.status, new.status; end if;
        when 'scheduled' then
          if new.status in ('review','published','archived') and _owner_or_editor then null;
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

  _content_changed := new.slug is distinct from old.slug
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

  if old.status = 'published' and new.status = 'published' and _content_changed then
    raise exception 'BLOG_PUBLISHED_CONTENT_REQUIRES_REVIEW_TRANSITION';
  end if;

  if new.status = 'scheduled' then
    if new.scheduled_at is null then raise exception 'BLOG_SCHEDULE_REQUIRES_SCHEDULED_AT'; end if;
    if _uid is not null and new.scheduled_at <= now() then raise exception 'BLOG_SCHEDULE_MUST_BE_FUTURE'; end if;
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

commit;
