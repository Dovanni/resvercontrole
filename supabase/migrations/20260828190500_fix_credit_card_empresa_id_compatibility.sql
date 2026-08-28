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

  select min(uca.empresa_id), count(*)::integer
    into v_empresa_id, v_count
  from public.user_company_access uca
  where uca.user_id = new.user_id
    and uca.status = 'active';

  if v_count = 1 then
    new.empresa_id := v_empresa_id;
    return new;
  end if;

  raise exception 'empresa_id is required when user has % active companies', v_count;
end;
$$;

revoke all on function public.set_single_active_empresa_id() from public;

drop trigger if exists trg_cartoes_credito_set_empresa_id on public.cartoes_credito;
create trigger trg_cartoes_credito_set_empresa_id
before insert or update of user_id, empresa_id on public.cartoes_credito
for each row execute function public.set_single_active_empresa_id();

drop trigger if exists trg_cartoes_lancamentos_set_empresa_id on public.cartoes_lancamentos;
create trigger trg_cartoes_lancamentos_set_empresa_id
before insert or update of user_id, empresa_id on public.cartoes_lancamentos
for each row execute function public.set_single_active_empresa_id();

drop trigger if exists trg_cartoes_faturas_set_empresa_id on public.cartoes_faturas;
create trigger trg_cartoes_faturas_set_empresa_id
before insert or update of user_id, empresa_id on public.cartoes_faturas
for each row execute function public.set_single_active_empresa_id();
