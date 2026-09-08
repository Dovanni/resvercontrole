-- VEJAMAIS ERP — Blog Editorial V2
-- R9.3 — Rollback do publicador agendado seguro
-- Executar somente mediante autorização explícita e após auditoria do estado.

begin;

drop function if exists blog_private.publish_due_scheduled_posts(integer);

drop table if exists blog_private.blog_scheduled_publication_attempts;

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

alter table public.blog_workflow_events
  drop constraint if exists blog_workflow_events_actor_source_check;

alter table public.blog_workflow_events
  drop column if exists actor_source;

commit;
