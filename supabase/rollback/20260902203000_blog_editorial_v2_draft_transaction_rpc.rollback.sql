-- VEJAMAIS ERP — Blog Editorial V2
-- Rollback da Fase 3-U.1

begin;

drop function if exists public.blog_save_draft_transaction(
  text, uuid, integer, text, text, text, jsonb, uuid, uuid, uuid[],
  text, text, text, text, text, integer
);

-- Restaura o guard exatamente ao contrato anterior à 3-U.1: revision_number
-- sozinho não é considerado mudança material.
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

commit;
