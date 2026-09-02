-- VEJAMAIS ERP — Blog Editorial V2
-- Hardening de laboratório derivado dos Supabase Advisors da Fase 3-I.3.
-- NÃO é migration automática. Após validação, estas mudanças devem ser
-- incorporadas/squashadas na migration canônica antes de staging.

begin;

-- Índices para FKs de auditoria sinalizadas pelo advisor.
create index if not exists blog_authors_created_by_idx on public.blog_authors(created_by);
create index if not exists blog_categories_created_by_idx on public.blog_categories(created_by);
create index if not exists blog_editorial_members_created_by_idx on public.blog_editorial_members(created_by);
create index if not exists blog_post_revisions_created_by_idx on public.blog_post_revisions(created_by);
create index if not exists blog_post_tags_created_by_idx on public.blog_post_tags(created_by);
create index if not exists blog_posts_updated_by_idx on public.blog_posts(updated_by);
create index if not exists blog_posts_reviewed_by_idx on public.blog_posts(reviewed_by);
create index if not exists blog_posts_published_by_idx on public.blog_posts(published_by);
create index if not exists blog_tags_created_by_idx on public.blog_tags(created_by);
create index if not exists blog_workflow_events_actor_user_id_idx on public.blog_workflow_events(actor_user_id);

-- Consolidar SELECT público + editorial para evitar policies permissivas duplicadas.
drop policy if exists blog_categories_public_read on public.blog_categories;
drop policy if exists blog_categories_editorial_read_all on public.blog_categories;
create policy blog_categories_anon_read_active on public.blog_categories
for select to anon using (is_active = true);
create policy blog_categories_authenticated_read on public.blog_categories
for select to authenticated using (
  is_active = true or (select blog_private.has_editorial_role(array['owner','editor','author','reviewer']))
);

drop policy if exists blog_tags_public_read on public.blog_tags;
drop policy if exists blog_tags_editorial_read_all on public.blog_tags;
create policy blog_tags_anon_read_active on public.blog_tags
for select to anon using (is_active = true);
create policy blog_tags_authenticated_read on public.blog_tags
for select to authenticated using (
  is_active = true or (select blog_private.has_editorial_role(array['owner','editor','author','reviewer']))
);

drop policy if exists blog_authors_public_read on public.blog_authors;
drop policy if exists blog_authors_editorial_read_all on public.blog_authors;
create policy blog_authors_anon_read_active on public.blog_authors
for select to anon using (is_active = true);
create policy blog_authors_authenticated_read on public.blog_authors
for select to authenticated using (
  is_active = true or (select blog_private.has_editorial_role(array['owner','editor','author','reviewer']))
);

drop policy if exists blog_posts_public_read_published on public.blog_posts;
drop policy if exists blog_posts_editorial_read_all on public.blog_posts;
create policy blog_posts_anon_read_published on public.blog_posts
for select to anon using (status = 'published' and published_at is not null and published_at <= now());
create policy blog_posts_authenticated_read on public.blog_posts
for select to authenticated using (
  (status = 'published' and published_at is not null and published_at <= now())
  or (select blog_private.has_editorial_role(array['owner','editor','author','reviewer']))
);

drop policy if exists blog_post_tags_public_read_published on public.blog_post_tags;
drop policy if exists blog_post_tags_editorial_read_all on public.blog_post_tags;
create policy blog_post_tags_anon_read_published on public.blog_post_tags
for select to anon using (
  exists (
    select 1 from public.blog_posts p
    where p.id = post_id and p.status = 'published' and p.published_at is not null and p.published_at <= now()
  )
);
create policy blog_post_tags_authenticated_read on public.blog_post_tags
for select to authenticated using (
  exists (
    select 1 from public.blog_posts p
    where p.id = post_id and p.status = 'published' and p.published_at is not null and p.published_at <= now()
  )
  or (select blog_private.has_editorial_role(array['owner','editor','author','reviewer']))
);

-- Consolidar UPDATE de posts em uma única policy; o trigger continua sendo
-- a camada autoritativa para transições e four-eyes.
drop policy if exists blog_posts_owner_editor_update on public.blog_posts;
drop policy if exists blog_posts_author_update_own_draft on public.blog_posts;
create policy blog_posts_editorial_update on public.blog_posts
for update to authenticated
using (
  (select blog_private.has_editorial_role(array['owner','editor']))
  or (
    created_by = (select auth.uid())
    and status = 'draft'
    and (select blog_private.has_editorial_role(array['author']))
  )
)
with check (
  (select blog_private.has_editorial_role(array['owner','editor']))
  or (
    created_by = (select auth.uid())
    and status in ('draft','review')
    and (select blog_private.has_editorial_role(array['author']))
  )
);

commit;
