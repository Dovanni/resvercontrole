create or replace function public.set_single_active_empresa_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_count integer;
begin
  if new.empresa_id is not null then
    return new;
  end if;

  if new.user_id is null then
    raise exception 'user_id is required to resolve empresa_id';
  end if;

  select count(*)::integer
    into v_count
  from public.user_company_access uca
  where uca.user_id = new.user_id
    and uca.status = 'active';

  if v_count = 1 then
    select uca.empresa_id
      into v_empresa_id
    from public.user_company_access uca
    where uca.user_id = new.user_id
      and uca.status = 'active'
    limit 1;

    new.empresa_id := v_empresa_id;
    return new;
  end if;

  raise exception 'empresa_id is required when user has % active companies', v_count;
end;
$$;

revoke all on function public.set_single_active_empresa_id() from public;
