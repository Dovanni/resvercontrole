-- VEJAMAIS ERP — Blog Editorial V2
-- Fase 3-I — Migration repository-only
-- IMPORTANTE: este arquivo foi preparado para revisão e NÃO deve ser aplicado
-- ao Supabase sem auditoria e autorização explícita.

begin;

create schema if not exists blog_private;
revoke all on schema blog_private from public;
grant usage on schema blog_private to authenticated;

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_categories_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint blog_categories_name_not_blank_check check (btrim(name) <> ''),
  constraint blog_categories_sort_order_check check (sort_order >= 0)
);
create unique index blog_categories_slug_uidx on public.blog_categories (slug);
create unique index blog_categories_name_lower_uidx on public.blog_categories (lower(name));
create index blog_categories_active_sort_idx on public.blog_categories (is_active, sort_order, name);

create table public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_tags_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint blog_tags_name_not_blank_check check (btrim(name) <> '')
);
create unique index blog_tags_slug_uidx on public.blog_tags (slug);
create unique index blog_tags_name_lower_uidx on public.blog_tags (lower(name));
create index blog_tags_active_name_idx on public.blog_tags (is_active, name);

create table public.blog_authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slug text not null,
  display_name text not null,
  bio text,
  avatar_path text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_authors_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint blog_authors_display_name_not_blank_check check (btrim(display_name) <> '')
);
create unique index blog_authors_slug_uidx on public.blog_authors (slug);
create unique index blog_authors_user_uidx on public.blog_authors (user_id) where user_id is not null;
create index blog_authors_active_display_idx on public.blog_authors (is_active, display_name);

create table public.blog_editorial_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  author_id uuid references public.blog_authors(id) on delete set null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_editorial_members_role_check check (role in ('owner', 'editor', 'author', 'reviewer'))
);
create unique index blog_editorial_members_author_uidx on public.blog_editorial_members (author_id) where author_id is not null;
create index blog_editorial_members_active_role_idx on public.blog_editorial_members (active, role);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  excerpt text not null,
  content jsonb not null default '[]'::jsonb,
  category_id uuid references public.blog_categories(id) on delete restrict,
  author_id uuid references public.blog_authors(id) on delete restrict,
  status text not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  featured_image_path text,
  featured_image_alt text,
  meta_title text,
  meta_description text,
  focus_keyword text,
  reading_time_minutes integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint blog_posts_title_not_blank_check check (btrim(title) <> ''),
  constraint blog_posts_excerpt_not_blank_check check (btrim(excerpt) <> ''),
  constraint blog_posts_content_array_check check (jsonb_typeof(content) = 'array'),
  constraint blog_posts_status_check check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  constraint blog_posts_reading_time_check check (reading_time_minutes > 0),
  constraint blog_posts_scheduled_contract_check check (status <> 'scheduled' or scheduled_at is not null),
  constraint blog_posts_published_contract_check check (status <> 'published' or published_at is not null)
);
create unique index blog_posts_slug_uidx on public.blog_posts (slug);
create index blog_posts_status_updated_idx on public.blog_posts (status, updated_at desc);
create index blog_posts_publication_idx on public.blog_posts (published_at desc) where status = 'published';
create index blog_posts_schedule_idx on public.blog_posts (scheduled_at) where status = 'scheduled';
create index blog_posts_category_idx on public.blog_posts (category_id, status, published_at desc);
create index blog_posts_author_idx on public.blog_posts (author_id, status, published_at desc);
create index blog_posts_created_by_idx on public.blog_posts (created_by, status, updated_at desc);

create table public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_id)
);
create index blog_post_tags_tag_post_idx on public.blog_post_tags (tag_id, post_id);

create table public.blog_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blog_post_revisions_revision_number_check check (revision_number > 0),
  constraint blog_post_revisions_snapshot_object_check check (jsonb_typeof(snapshot) = 'object'),
  unique (post_id, revision_number)
);
create index blog_post_revisions_post_created_idx on public.blog_post_revisions (post_id, created_at desc);

create table public.blog_workflow_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint blog_workflow_events_from_status_check check (from_status is null or from_status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  constraint blog_workflow_events_to_status_check check (to_status in ('draft', 'review', 'scheduled', 'published', 'archived'))
);
create index blog_workflow_events_post_created_idx on public.blog_workflow_events (post_id, created_at desc);

create table public.blog_post_reviews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  reviewer_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  decision text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint blog_post_reviews_decision_check check (decision in ('approved', 'changes_requested'))
);
create index blog_post_reviews_post_created_idx on public.blog_post_reviews (post_id, created_at desc);
create index blog_post_reviews_reviewer_created_idx on public.blog_post_reviews (reviewer_user_id, created_at desc);

create or replace function blog_private.has_editorial_role(_roles text[])
returns boolean language sql stable security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.blog_editorial_members m
       where m.user_id = auth.uid() and m.active = true and m.role = any(_roles)
     );
$$;
revoke all on function blog_private.has_editorial_role(text[]) from public;
grant execute on function blog_private.has_editorial_role(text[]) to authenticated;

create or replace function blog_private.can_edit_post(_post_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
  select auth.uid() is not null
     and (
       blog_private.has_editorial_role(array['owner','editor'])
       or (
         blog_private.has_editorial_role(array['author'])
         and exists (
           select 1 from public.blog_posts p
           where p.id = _post_id and p.created_by = auth.uid() and p.status = 'draft'
         )
       )
     );
$$;
revoke all on function blog_private.can_edit_post(uuid) from public;
grant execute on function blog_private.can_edit_post(uuid) to authenticated;

create or replace function blog_private.can_manage_media(_object_name text)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _post_text text;
  _post_id uuid;
begin
  if auth.uid() is null then return false; end if;
  if blog_private.has_editorial_role(array['owner','editor']) then return true; end if;
  if not blog_private.has_editorial_role(array['author']) then return false; end if;
  if split_part(_object_name, '/', 1) <> 'posts' then return false; end if;
  _post_text := split_part(_object_name, '/', 2);
  if _post_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  _post_id := _post_text::uuid;
  return blog_private.can_edit_post(_post_id);
end;
$$;
revoke all on function blog_private.can_manage_media(text) from public;
grant execute on function blog_private.can_manage_media(text) to authenticated;

create or replace function blog_private.guard_blog_post_write()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _owner_or_editor boolean := false;
  _author_own boolean := false;
  _content_changed boolean := false;
begin
  if _uid is not null then
    _owner_or_editor := blog_private.has_editorial_role(array['owner','editor']);
  end if;

  if tg_op = 'INSERT' then
    if _uid is not null then
      new.created_by := _uid;
      new.updated_by := _uid;
      if new.status <> 'draft' then raise exception 'BLOG_INITIAL_STATUS_MUST_BE_DRAFT'; end if;
      if not (_owner_or_editor or blog_private.has_editorial_role(array['author'])) then
        raise exception 'BLOG_EDITORIAL_WRITE_FORBIDDEN';
      end if;
    end if;
    return new;
  end if;

  if _uid is not null then
    new.created_by := old.created_by;
    new.updated_by := _uid;
    new.published_by := old.published_by;
    new.reviewed_by := old.reviewed_by;
    _author_own := blog_private.has_editorial_role(array['author']) and old.created_by = _uid;

    if old.status = new.status then
      if _owner_or_editor then null;
      elsif _author_own and old.status = 'draft' then null;
      else raise exception 'BLOG_EDITORIAL_WRITE_FORBIDDEN';
      end if;
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
    or new.focus_keyword is distinct from old.focus_keyword;

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

create or replace function blog_private.capture_blog_post_revision()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
declare _next_revision integer;
begin
  select coalesce(max(r.revision_number), 0) + 1 into _next_revision
  from public.blog_post_revisions r where r.post_id = new.id;
  insert into public.blog_post_revisions (post_id, revision_number, snapshot, created_by, reason)
  values (
    new.id,
    _next_revision,
    to_jsonb(new),
    coalesce(auth.uid(), new.updated_by, new.created_by),
    case when tg_op = 'INSERT' then 'initial'
         when old.status is distinct from new.status then 'status_change'
         else 'content_update' end
  );
  return new;
end;
$$;
revoke all on function blog_private.capture_blog_post_revision() from public;

create or replace function blog_private.capture_blog_workflow_event()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, blog_private, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.blog_workflow_events (post_id, from_status, to_status, actor_user_id)
    values (new.id, null, new.status, coalesce(auth.uid(), new.updated_by, new.created_by));
  elsif old.status is distinct from new.status then
    insert into public.blog_workflow_events (post_id, from_status, to_status, actor_user_id)
    values (new.id, old.status, new.status, coalesce(auth.uid(), new.updated_by, new.created_by));
  end if;
  return new;
end;
$$;
revoke all on function blog_private.capture_blog_workflow_event() from public;

create trigger blog_posts_10_guard_write before insert or update on public.blog_posts
for each row execute function blog_private.guard_blog_post_write();
create trigger blog_posts_20_set_updated_at before update on public.blog_posts
for each row execute function public.set_updated_at();
create trigger blog_posts_90_capture_revision after insert or update on public.blog_posts
for each row execute function blog_private.capture_blog_post_revision();
create trigger blog_posts_91_capture_workflow after insert or update on public.blog_posts
for each row execute function blog_private.capture_blog_workflow_event();
create trigger blog_categories_set_updated_at before update on public.blog_categories
for each row execute function public.set_updated_at();
create trigger blog_tags_set_updated_at before update on public.blog_tags
for each row execute function public.set_updated_at();
create trigger blog_authors_set_updated_at before update on public.blog_authors
for each row execute function public.set_updated_at();
create trigger blog_editorial_members_set_updated_at before update on public.blog_editorial_members
for each row execute function public.set_updated_at();

alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_authors enable row level security;
alter table public.blog_editorial_members enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.blog_post_revisions enable row level security;
alter table public.blog_workflow_events enable row level security;
alter table public.blog_post_reviews enable row level security;

create policy blog_categories_public_read on public.blog_categories for select to anon, authenticated using (is_active = true);
create policy blog_categories_editorial_read_all on public.blog_categories for select to authenticated using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_categories_owner_editor_insert on public.blog_categories for insert to authenticated with check ((select blog_private.has_editorial_role(array['owner','editor'])));
create policy blog_categories_owner_editor_update on public.blog_categories for update to authenticated using ((select blog_private.has_editorial_role(array['owner','editor']))) with check ((select blog_private.has_editorial_role(array['owner','editor'])));
create policy blog_categories_owner_editor_delete on public.blog_categories for delete to authenticated using ((select blog_private.has_editorial_role(array['owner','editor'])));

create policy blog_tags_public_read on public.blog_tags for select to anon, authenticated using (is_active = true);
create policy blog_tags_editorial_read_all on public.blog_tags for select to authenticated using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_tags_owner_editor_insert on public.blog_tags for insert to authenticated with check ((select blog_private.has_editorial_role(array['owner','editor'])));
create policy blog_tags_owner_editor_update on public.blog_tags for update to authenticated using ((select blog_private.has_editorial_role(array['owner','editor']))) with check ((select blog_private.has_editorial_role(array['owner','editor'])));
create policy blog_tags_owner_editor_delete on public.blog_tags for delete to authenticated using ((select blog_private.has_editorial_role(array['owner','editor'])));

create policy blog_authors_public_read on public.blog_authors for select to anon, authenticated using (is_active = true);
create policy blog_authors_editorial_read_all on public.blog_authors for select to authenticated using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_authors_owner_editor_insert on public.blog_authors for insert to authenticated with check ((select blog_private.has_editorial_role(array['owner','editor'])));
create policy blog_authors_owner_editor_update on public.blog_authors for update to authenticated using ((select blog_private.has_editorial_role(array['owner','editor']))) with check ((select blog_private.has_editorial_role(array['owner','editor'])));
create policy blog_authors_owner_editor_delete on public.blog_authors for delete to authenticated using ((select blog_private.has_editorial_role(array['owner','editor'])));

create policy blog_editorial_members_self_or_owner_read on public.blog_editorial_members for select to authenticated
using (user_id = (select auth.uid()) or (select blog_private.has_editorial_role(array['owner'])));
create policy blog_editorial_members_owner_insert on public.blog_editorial_members for insert to authenticated with check ((select blog_private.has_editorial_role(array['owner'])));
create policy blog_editorial_members_owner_update on public.blog_editorial_members for update to authenticated using ((select blog_private.has_editorial_role(array['owner']))) with check ((select blog_private.has_editorial_role(array['owner'])));
create policy blog_editorial_members_owner_delete on public.blog_editorial_members for delete to authenticated using ((select blog_private.has_editorial_role(array['owner'])));

create policy blog_posts_public_read_published on public.blog_posts for select to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());
create policy blog_posts_editorial_read_all on public.blog_posts for select to authenticated
using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_posts_editorial_insert_draft on public.blog_posts for insert to authenticated
with check (created_by = (select auth.uid()) and status = 'draft' and (select blog_private.has_editorial_role(array['owner','editor','author'])));
create policy blog_posts_owner_editor_update on public.blog_posts for update to authenticated
using ((select blog_private.has_editorial_role(array['owner','editor']))) with check ((select blog_private.has_editorial_role(array['owner','editor'])));
create policy blog_posts_author_update_own_draft on public.blog_posts for update to authenticated
using (created_by = (select auth.uid()) and status = 'draft' and (select blog_private.has_editorial_role(array['author'])))
with check (created_by = (select auth.uid()) and status in ('draft','review') and (select blog_private.has_editorial_role(array['author'])));

create policy blog_post_tags_public_read_published on public.blog_post_tags for select to anon, authenticated
using (exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'published' and p.published_at is not null and p.published_at <= now()));
create policy blog_post_tags_editorial_read_all on public.blog_post_tags for select to authenticated
using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_post_tags_editorial_insert on public.blog_post_tags for insert to authenticated
with check ((select blog_private.can_edit_post(post_id)));
create policy blog_post_tags_editorial_delete on public.blog_post_tags for delete to authenticated
using ((select blog_private.can_edit_post(post_id)));

create policy blog_post_revisions_editorial_read on public.blog_post_revisions for select to authenticated
using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_workflow_events_editorial_read on public.blog_workflow_events for select to authenticated
using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_post_reviews_editorial_read on public.blog_post_reviews for select to authenticated
using ((select blog_private.has_editorial_role(array['owner','editor','author','reviewer'])));
create policy blog_post_reviews_reviewer_insert on public.blog_post_reviews for insert to authenticated
with check (
  reviewer_user_id = (select auth.uid())
  and (select blog_private.has_editorial_role(array['owner','editor','reviewer']))
  and exists (select 1 from public.blog_posts p where p.id = post_id and p.status = 'review')
);

revoke all on table public.blog_categories from anon, authenticated;
revoke all on table public.blog_tags from anon, authenticated;
revoke all on table public.blog_authors from anon, authenticated;
revoke all on table public.blog_editorial_members from anon, authenticated;
revoke all on table public.blog_posts from anon, authenticated;
revoke all on table public.blog_post_tags from anon, authenticated;
revoke all on table public.blog_post_revisions from anon, authenticated;
revoke all on table public.blog_workflow_events from anon, authenticated;
revoke all on table public.blog_post_reviews from anon, authenticated;

grant select on table public.blog_categories to anon, authenticated;
grant select on table public.blog_tags to anon, authenticated;
grant select on table public.blog_authors to anon, authenticated;
grant select on table public.blog_posts to anon, authenticated;
grant select on table public.blog_post_tags to anon, authenticated;
grant insert, update, delete on table public.blog_categories to authenticated;
grant insert, update, delete on table public.blog_tags to authenticated;
grant insert, update, delete on table public.blog_authors to authenticated;
grant select, insert, update, delete on table public.blog_editorial_members to authenticated;
grant insert, update on table public.blog_posts to authenticated;
grant insert, delete on table public.blog_post_tags to authenticated;
grant select on table public.blog_post_revisions to authenticated;
grant select on table public.blog_workflow_events to authenticated;
grant select, insert on table public.blog_post_reviews to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-media', 'blog-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy blog_media_public_metadata_read on storage.objects for select to anon, authenticated
using (bucket_id = 'blog-media');
create policy blog_media_editorial_insert on storage.objects for insert to authenticated
with check (bucket_id = 'blog-media' and (select blog_private.can_manage_media(name)));
create policy blog_media_editorial_update on storage.objects for update to authenticated
using (bucket_id = 'blog-media' and (select blog_private.can_manage_media(name)))
with check (bucket_id = 'blog-media' and (select blog_private.can_manage_media(name)));
create policy blog_media_editorial_delete on storage.objects for delete to authenticated
using (bucket_id = 'blog-media' and (select blog_private.can_manage_media(name)));

insert into public.blog_categories (slug, name, description, sort_order)
values
  ('gestao-financeira', 'Gestão Financeira', 'Fluxo de caixa, contas, indicadores e planejamento financeiro.', 10),
  ('vendas-e-clientes', 'Vendas e Clientes', 'Processo comercial, relacionamento com clientes e indicadores de vendas.', 20),
  ('estoque-e-compras', 'Estoque e Compras', 'Estoque, inventário, compras, fornecedores e abastecimento.', 30),
  ('gestao-empresarial', 'Gestão Empresarial', 'Rotinas administrativas, processos, indicadores e tomada de decisão.', 40),
  ('gestao-multiempresa', 'Gestão Multiempresa', 'Separação de contextos, papéis, segurança e visão gerencial multiempresa.', 50),
  ('tecnologia-e-seguranca', 'Tecnologia e Segurança', 'Boas práticas digitais, autenticação, dados, integrações e automação.', 60),
  ('vejamais-erp', 'VEJAMAIS ERP', 'Guias de recursos, conceitos do produto e novidades relevantes.', 70)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.blog_authors (slug, display_name, bio, is_active)
values ('equipe-editorial-vejamais-erp', 'Equipe Editorial VEJAMAIS ERP', 'Conteúdo educativo sobre gestão empresarial, tecnologia e uso responsável de sistemas de gestão.', true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  bio = excluded.bio,
  is_active = true,
  updated_at = now();

-- Bootstrap deliberadamente separado:
-- 1) não cadastra o primeiro owner editorial;
-- 2) não migra os 3 drafts locais;
-- 3) não cria cron/job de publicação automática;
-- 4) posts não recebem DELETE via Data API: retirada usa status='archived'.

commit;
