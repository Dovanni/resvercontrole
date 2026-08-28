drop policy if exists "Users manage own categorias_contas_pagar" on public.categorias_contas_pagar;
drop policy if exists "Multiempresa isolation" on public.categorias_contas_pagar;

create policy "Multiempresa isolation"
on public.categorias_contas_pagar
for all
to authenticated
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.empresa_id = categorias_contas_pagar.empresa_id
      and uca.user_id = auth.uid()
      and uca.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.empresa_id = categorias_contas_pagar.empresa_id
      and uca.user_id = auth.uid()
      and uca.status = 'active'
  )
);
