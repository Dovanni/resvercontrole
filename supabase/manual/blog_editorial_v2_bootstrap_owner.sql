-- VEJAMAIS ERP — Blog Editorial V2
-- Bootstrap MANUAL do primeiro owner editorial.
-- NÃO é migration automática. NÃO executar sem autorização explícita.
-- Antes de executar, substitua REPLACE_WITH_OWNER_EMAIL pelo e-mail Auth exato.

begin;

do $$
declare
  _owner_email text := 'REPLACE_WITH_OWNER_EMAIL';
  _owner_user_id uuid;
  _matches integer;
begin
  if _owner_email = 'REPLACE_WITH_OWNER_EMAIL' then
    raise exception 'BLOG_OWNER_BOOTSTRAP_EMAIL_NOT_CONFIGURED';
  end if;

  select count(*), min(id)
    into _matches, _owner_user_id
  from auth.users
  where lower(email) = lower(_owner_email);

  if _matches <> 1 or _owner_user_id is null then
    raise exception 'BLOG_OWNER_BOOTSTRAP_REQUIRES_EXACTLY_ONE_AUTH_USER: matches=%', _matches;
  end if;

  if exists (select 1 from public.blog_editorial_members where role = 'owner' and active = true) then
    raise exception 'BLOG_OWNER_BOOTSTRAP_ALREADY_COMPLETED';
  end if;

  insert into public.blog_editorial_members (user_id, role, active, created_by)
  values (_owner_user_id, 'owner', true, _owner_user_id);
end;
$$;

commit;
