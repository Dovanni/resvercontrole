-- VEJAMAIS ERP — CANONICAL BASELINE CANDIDATE v1
-- Repository-only artifact. DO NOT APPLY. NOT CERTIFIED FOR DATABASE EXECUTION.
-- Synthesized statically from 173 byte-attested historical migrations.
-- Operational DML, historical data corrections, blog pilot objects, private incident
-- snapshots, duplicate migrations and test RPCs are intentionally excluded.


REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Authenticated receives table privileges required for PostgREST; RLS remains authoritative.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.plans TO anon;

ALTER TABLE public.aportes_financeiros ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bank_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cartoes_faturas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cartoes_lancamentos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.categorias_contas_pagar ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compras_itens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.controle_vendas_diario ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.controle_vendas_fornecedor ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.controle_vendas_fornecedor_historico ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dre_classificacoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dre_regras ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_routing_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pending_onboardings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_webhook_runtime_diagnostics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final policy: profiles.own profile
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final policy: products.own products
CREATE POLICY "own products" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final policy: sales.own sales
CREATE POLICY "own sales" ON public.sales FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final policy: sale_items.own sale items
CREATE POLICY "own sale items" ON public.sale_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final policy: finance_entries.own finance
CREATE POLICY "own finance" ON public.finance_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final policy: customers.own customers
CREATE POLICY "own customers" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final policy: suppliers.own suppliers
CREATE POLICY "own suppliers" ON public.suppliers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final policy: payables.own payables
CREATE POLICY "own payables" ON public.payables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260616214246_53c304ae-016a-44fe-86ce-7d7427d857d9.sql | final policy: receivables.own receivables
CREATE POLICY "own receivables" ON public.receivables FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- source: 20260616215411_25ada916-2e42-410c-a1a9-a47819029dce.sql | final policy: company_settings.own settings
CREATE POLICY "own settings" ON public.company_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260617002237_80220513-bc4e-43be-b99e-a474b31267e4.sql | final policy: controle_vendas_diario.own rows
CREATE POLICY "own rows" ON public.controle_vendas_diario FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260617002237_80220513-bc4e-43be-b99e-a474b31267e4.sql | final policy: controle_vendas_fornecedor.own rows
CREATE POLICY "own rows" ON public.controle_vendas_fornecedor FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | final policy: bank_accounts.own bank_accounts
CREATE POLICY "own bank_accounts" ON public.bank_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | final policy: bank_movements.own bank_movements
CREATE POLICY "own bank_movements" ON public.bank_movements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260617014243_516061f3-55a6-45c7-8403-d7b9f1e0f41f.sql | final policy: payment_routing_rules.users manage their routing rules
CREATE POLICY "users manage their routing rules"
  ON public.payment_routing_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260617204956_e3fa217e-6550-4efa-95c4-43cec18c18f5.sql | final policy: controle_vendas_fornecedor_historico.users manage own fornecedor historico
CREATE POLICY "Users manage own fornecedor historico"
  ON public.controle_vendas_fornecedor_historico
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- source: 20260617221702_08d2fa92-e44a-4958-9cf8-b75653eb06d9.sql | final policy: categorias_contas_pagar.users manage own categorias_contas_pagar
CREATE POLICY "Users manage own categorias_contas_pagar"
  ON public.categorias_contas_pagar
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | final policy: cartoes_credito.own cartoes
CREATE POLICY "own cartoes" ON public.cartoes_credito FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | final policy: cartoes_lancamentos.own cartoes_lancamentos
CREATE POLICY "own cartoes_lancamentos" ON public.cartoes_lancamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | final policy: cartoes_faturas.own cartoes_faturas
CREATE POLICY "own cartoes_faturas" ON public.cartoes_faturas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260618005921_414315c7-4ece-4d34-bac6-e710a982434e.sql | final policy: compras.own compras
CREATE POLICY "own compras" ON public.compras FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260618005921_414315c7-4ece-4d34-bac6-e710a982434e.sql | final policy: compras_itens.own compras_itens
CREATE POLICY "own compras_itens" ON public.compras_itens FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | final policy: audit_log.users read own audit
CREATE POLICY "users read own audit"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_regras.dre_regras_select
CREATE POLICY "dre_regras_select" ON public.dre_regras FOR SELECT TO authenticated USING (tenant_id = auth.uid());

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_regras.dre_regras_insert
CREATE POLICY "dre_regras_insert" ON public.dre_regras FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid() AND user_id = auth.uid());

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_regras.dre_regras_update
CREATE POLICY "dre_regras_update" ON public.dre_regras FOR UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_regras.dre_regras_delete
CREATE POLICY "dre_regras_delete" ON public.dre_regras FOR DELETE TO authenticated USING (tenant_id = auth.uid());

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_classificacoes.dre_class_select
CREATE POLICY "dre_class_select" ON public.dre_classificacoes FOR SELECT TO authenticated USING (tenant_id = auth.uid());

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_classificacoes.dre_class_insert
CREATE POLICY "dre_class_insert" ON public.dre_classificacoes FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid() AND user_id = auth.uid());

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_classificacoes.dre_class_update
CREATE POLICY "dre_class_update" ON public.dre_classificacoes FOR UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final policy: dre_classificacoes.dre_class_delete
CREATE POLICY "dre_class_delete" ON public.dre_classificacoes FOR DELETE TO authenticated USING (tenant_id = auth.uid());

-- source: 20260807000150_9c67a433-eaf9-43b9-9ae2-578bb84da29a.sql | final policy: controle_vendas_diario.multiempresa isolation
CREATE POLICY "Multiempresa isolation" ON public.controle_vendas_diario FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_company_access.empresa_id = controle_vendas_diario.empresa_id 
        AND user_company_access.user_id = auth.uid()
    )
);

-- source: 20260807013629_9cb1c7e1-0808-418d-9197-5a4eccb28a0f.sql | final policy: user_company_access.users can view their own memberships
CREATE POLICY "Users can view their own memberships"
ON public.user_company_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- source: 20260808211557_0e6933d5-b96f-42c2-b37a-e6835149ea31.sql | final policy: subscriptions.users can view their company subscription
CREATE POLICY "Users can view their company subscription" ON public.subscriptions
    FOR SELECT TO authenticated
    USING (empresa_id IN (
        SELECT empresa_id FROM public.user_company_access WHERE user_id = auth.uid()
    ));

-- source: 20260808212916_7dd4fb6e-106b-456f-96a1-2f547f5e1f01.sql | final policy: plans.plans are viewable by everyone
CREATE POLICY "Plans are viewable by everyone" ON public.plans
    FOR SELECT TO public 
    USING (is_active = true AND is_public = true);

-- source: 20260810225223_stripe_webhook_runtime_diagnostics_reconciliation.sql | final policy: stripe_webhook_runtime_diagnostics.service role can do everything
CREATE POLICY "Service role can do everything" ON public.stripe_webhook_runtime_diagnostics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- source: 20260814023633_f203b28d-9a8e-4af2-9d7f-791ed49c49ac.sql | final policy: rate_limits.service role only access
CREATE POLICY "Service role only access" ON public.rate_limits FOR ALL TO service_role USING (true);

-- source: 20260814023858_b6c45690-fa17-4e92-8f26-5f3d6f34cdf8.sql | final policy: checkout_attempts.service role only
CREATE POLICY "Service role only" ON public.checkout_attempts FOR ALL TO service_role USING (true);

-- source: 20260814023858_b6c45690-fa17-4e92-8f26-5f3d6f34cdf8.sql | final policy: auth_rate_limits.service role only
CREATE POLICY "Service role only" ON public.auth_rate_limits FOR ALL TO service_role USING (true);

-- source: 20260814023858_b6c45690-fa17-4e92-8f26-5f3d6f34cdf8.sql | final policy: payment_events.service role only
CREATE POLICY "Service role only" ON public.payment_events FOR ALL TO service_role USING (true);

-- source: 20260814024035_c4795347-9a3d-4e82-b53d-1b16d8847fd3.sql | final policy: user_roles.users can read their own roles
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- source: 20260814024035_c4795347-9a3d-4e82-b53d-1b16d8847fd3.sql | final policy: user_company_access.users can see their own company access
CREATE POLICY "Users can see their own company access" ON public.user_company_access FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- source: 20260814024101_e6f43060-19f2-4341-bb2f-34b94749c65c.sql | final policy: pending_onboardings.service role only
CREATE POLICY "Service role only" ON public.pending_onboardings FOR ALL TO service_role USING (true);

-- source: 20260814123214_bf9ba6fd-4e74-4038-83e3-bade2b0d3dbe.sql | final policy: empresas.users can view their own companies
CREATE POLICY "Users can view their own companies"
ON public.empresas FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() OR 
  public.check_current_user_is_active_member(id)
);

-- source: 20260814123214_bf9ba6fd-4e74-4038-83e3-bade2b0d3dbe.sql | final policy: company_invitations.admins can manage invitations
CREATE POLICY "Admins can manage invitations"
ON public.company_invitations FOR ALL
TO authenticated
USING (public.check_current_user_is_admin(empresa_id))
WITH CHECK (public.check_current_user_is_admin(empresa_id));

-- Function execution is intentionally explicit; no blanket authenticated grant.
GRANT EXECUTE ON FUNCTION public.get_my_multiempresa_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_company_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_company_invite_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_empresa_defaults(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_current_user_is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_current_user_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, public.rpc_sale_item_input[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_compra(uuid, jsonb, public.rpc_purchase_item_input[], public.rpc_purchase_payable_input[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) TO authenticated;

-- Deliberately absent: GRANT EXECUTE ON ALL FUNCTIONS ... TO authenticated.
-- Deliberately absent: public.rpc_registrar_compra_test.
