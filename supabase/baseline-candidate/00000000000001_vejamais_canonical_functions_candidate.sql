-- VEJAMAIS ERP — CANONICAL BASELINE CANDIDATE v1
-- Repository-only artifact. DO NOT APPLY. NOT CERTIFIED FOR DATABASE EXECUTION.
-- Synthesized statically from 173 byte-attested historical migrations.
-- Operational DML, historical data corrections, blog pilot objects, private incident
-- snapshots, duplicate migrations and test RPCs are intentionally excluded.


-- source: 20260808153630_38c8d8fd-8925-455e-8e6c-b97cdb7b01f0.sql | final function name: public.handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    DECLARE
        v_has_pending BOOLEAN;
    BEGIN
        -- Provisionar somente o perfil básico
        INSERT INTO public.profiles (id, full_name, email) 
        VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

        -- Nova regra: Impedir fallback genérico se existir pending onboarding
        SELECT EXISTS (
            SELECT 1 FROM public.pending_onboardings 
            WHERE auth_user_id = NEW.id 
              AND status = 'pending' 
              AND expires_at > now()
        ) INTO v_has_pending;

        -- Fallback legado permanece apenas para usuários antigos sem pending ou convites via membership direto
        -- Se NÃO houver pending e NÃO houver empresa vinculada, criaria a genérica? 
        -- Por segurança, o provisionamento legado da "Minha Empresa" é agora isolado para evitar duplicidade com onboarding.
        
        RETURN NEW;
    END;
$function$;

-- source: 20260813190516_7eda3ba4-0e2f-472b-9495-749372322d5d.sql | final function name: public.decrement_stock_on_sale_item
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  -- NEW.empresa_id deve estar presente
  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_id obrigatório em sale_items';
  END IF;

  UPDATE public.products
    SET stock = stock - NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id 
      AND empresa_id = NEW.empresa_id; -- Troca user_id por empresa_id (Canonico Wave A/B)
      
  RETURN NEW;
END; $function$;

-- source: 20260809120627_146e213c-f1e0-4e4b-ba8a-7fc708dd9eac.sql | final function name: public.create_finance_for_sale
CREATE OR REPLACE FUNCTION public.create_finance_for_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.total > 0 AND NEW.payment_method IN ('dinheiro','pix','debito') THEN
    INSERT INTO public.finance_entries (user_id, empresa_id, type, category, amount, description, sale_id, entry_date)
    VALUES (NEW.user_id, NEW.empresa_id, 'income', 'venda', NEW.total, COALESCE('Venda '||COALESCE(NEW.customer_name,'balcão'),'Venda'), NEW.id, NEW.sold_at);
  END IF;
  RETURN NEW;
END; $$;

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final function name: public.set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- source: 20260809120627_146e213c-f1e0-4e4b-ba8a-7fc708dd9eac.sql | final function name: public.payable_to_finance
CREATE OR REPLACE FUNCTION public.payable_to_finance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    INSERT INTO public.finance_entries (user_id, empresa_id, type, category, amount, description, entry_date)
    VALUES (NEW.user_id, NEW.empresa_id, 'expense', NEW.category, COALESCE(NEW.paid_amount, NEW.amount), NEW.description, COALESCE(NEW.paid_at, now()));
  END IF;
  RETURN NEW;
END; $$;

-- source: 20260813190516_7eda3ba4-0e2f-472b-9495-749372322d5d.sql | final function name: public.create_receivable_for_sale
CREATE OR REPLACE FUNCTION public.create_receivable_for_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE cust_name text;
BEGIN
  IF NEW.channel = 'recursos_financeiros' THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS NULL THEN
     RAISE EXCEPTION 'empresa_id obrigatório em sales para gerar recebível';
  END IF;

  IF NEW.status IN ('confirmado','separacao','enviado','entregue')
     AND NEW.payment_method IN ('prazo','boleto','crediario','pix_prazo','cartao','cartao_credito','cartao_debito','mercado_livre')
     AND NEW.total > 0
     AND NOT EXISTS (SELECT 1 FROM public.receivables WHERE sale_id = NEW.id)
  THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id AND empresa_id = NEW.empresa_id;
    
    INSERT INTO public.receivables (user_id, empresa_id, customer_id, sale_id, description, amount, due_date, payment_method, bank_account_id)
    VALUES (
      NEW.user_id, 
      NEW.empresa_id, 
      NEW.customer_id, 
      NEW.id,
      'Venda ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
      NEW.total, 
      (NEW.sold_at::date + INTERVAL '30 days')::date,
      NEW.payment_method, 
      NEW.bank_account_id
    );
  END IF;
  RETURN NEW;
END; $function$;

-- source: 20260809120627_146e213c-f1e0-4e4b-ba8a-7fc708dd9eac.sql | final function name: public.receivable_to_finance
CREATE OR REPLACE FUNCTION public.receivable_to_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  delta numeric(12,2);
BEGIN
  delta := COALESCE(NEW.received_amount,0) - COALESCE(OLD.received_amount,0);
  IF delta > 0 THEN
    INSERT INTO public.finance_entries (user_id, empresa_id, type, category, amount, description, entry_date)
    VALUES (NEW.user_id, NEW.empresa_id, 'income', 'recebimento', delta, NEW.description, COALESCE(NEW.received_at, now()));
  END IF;
  RETURN NEW;
END; $$;

-- source: 20260616215411_25ada916-2e42-410c-a1a9-a47819029dce.sql | final function name: public.has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- source: 20260616215411_25ada916-2e42-410c-a1a9-a47819029dce.sql | final function name: public.assign_default_role
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE total int;
BEGIN
  SELECT count(*) INTO total FROM public.user_roles;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, CASE WHEN total = 0 THEN 'admin'::public.app_role ELSE 'vendedor'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- source: 20260809121347_60475a1a-dae7-4701-99d0-93762e52bdaa.sql | final function name: public.payable_to_bank_movement
CREATE OR REPLACE FUNCTION public.payable_to_bank_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  sup_name text;
  v_empresa_id uuid;
  v_actual_account_empresa_id uuid;
BEGIN
  -- Autoridade de empresa: sempre o payable original
  v_empresa_id := NEW.empresa_id;

  -- Validação de consistência se bank_account_id estiver presente
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT empresa_id INTO v_actual_account_empresa_id FROM public.bank_accounts WHERE id = NEW.bank_account_id;
    
    IF v_actual_account_empresa_id IS DISTINCT FROM v_empresa_id THEN
      RAISE EXCEPTION 'A conta bancária selecionada não pertence à empresa do lançamento (ID: %, Empresa: %).', 
        NEW.bank_account_id, v_empresa_id;
    END IF;
  END IF;

  -- Lógica de criação de movimento
  IF NEW.status = 'pago' AND (
      (OLD.status IS DISTINCT FROM 'pago') OR 
      (OLD.bank_account_id IS NULL AND NEW.bank_account_id IS NOT NULL)
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bank_movements 
      WHERE origin = 'payable' AND reference_id = NEW.id
    ) THEN
      SELECT name INTO sup_name FROM public.suppliers WHERE id = NEW.supplier_id AND empresa_id = v_empresa_id;
      
      INSERT INTO public.bank_movements
        (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
      VALUES (
        NEW.user_id,
        v_empresa_id,
        NEW.bank_account_id,
        COALESCE(NEW.paid_at::date, now()::date),
        'saida',
        NEW.category,
        COALESCE(sup_name || ' — ', '') || NEW.description,
        COALESCE(NEW.paid_amount, NEW.amount),
        'payable',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- source: 20260809121347_60475a1a-dae7-4701-99d0-93762e52bdaa.sql | final function name: public.receivable_to_bank_movement
CREATE OR REPLACE FUNCTION public.receivable_to_bank_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  delta numeric(14,2);
  cust_name text;
  v_empresa_id uuid;
  v_actual_account_empresa_id uuid;
BEGIN
  v_empresa_id := NEW.empresa_id;
  delta := COALESCE(NEW.received_amount,0) - COALESCE(OLD.received_amount,0);
  
  -- Validação de consistência se bank_account_id estiver presente
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT empresa_id INTO v_actual_account_empresa_id FROM public.bank_accounts WHERE id = NEW.bank_account_id;
    
    IF v_actual_account_empresa_id IS DISTINCT FROM v_empresa_id THEN
      RAISE EXCEPTION 'A conta bancária selecionada não pertence à empresa do recebimento (ID: %, Empresa: %).', 
        NEW.bank_account_id, v_empresa_id;
    END IF;
  END IF;

  IF delta > 0 AND NEW.bank_account_id IS NOT NULL THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id AND empresa_id = v_empresa_id;
    
    INSERT INTO public.bank_movements
      (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
    VALUES (
      NEW.user_id,
      v_empresa_id,
      NEW.bank_account_id,
      COALESCE(NEW.received_at::date, now()::date),
      'entrada',
      'Recebimento de venda',
      COALESCE(cust_name || ' — ', '') || NEW.description,
      delta,
      'receivable',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- source: 20260617014243_516061f3-55a6-45c7-8403-d7b9f1e0f41f.sql | final function name: public.ensure_default_routing
CREATE OR REPLACE FUNCTION public.ensure_default_routing(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  mp_id uuid;
BEGIN
  SELECT id INTO mp_id FROM public.bank_accounts
    WHERE user_id = _user_id AND bank = 'Mercado Pago' LIMIT 1;

  IF mp_id IS NULL THEN
    INSERT INTO public.bank_accounts (user_id, name, bank, account_type, initial_balance, color, status)
    VALUES (_user_id, 'Mercado Pago', 'Mercado Pago', 'digital', 0, '#00B1EA', 'ativa')
    RETURNING id INTO mp_id;
  END IF;

  INSERT INTO public.payment_routing_rules (user_id, payment_method, bank_account_id, fixo) VALUES
    (_user_id, 'cartao_credito', mp_id, true),
    (_user_id, 'cartao_debito',  mp_id, true),
    (_user_id, 'mercado_livre',  mp_id, true),
    (_user_id, 'cartao',         mp_id, true),
    (_user_id, 'pix',            NULL,  false),
    (_user_id, 'pix_prazo',      NULL,  false),
    (_user_id, 'deposito',       NULL,  false),
    (_user_id, 'dinheiro',       NULL,  false),
    (_user_id, 'transferencia',  NULL,  false),
    (_user_id, 'boleto',         NULL,  false),
    (_user_id, 'crediario',      NULL,  false),
    (_user_id, 'prazo',          NULL,  false)
  ON CONFLICT (user_id, payment_method) DO NOTHING;
END;
$$;

-- source: 20260809120627_146e213c-f1e0-4e4b-ba8a-7fc708dd9eac.sql | final function name: public.bank_account_initial_balance_movement
CREATE OR REPLACE FUNCTION public.bank_account_initial_balance_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.initial_balance IS NOT NULL AND NEW.initial_balance > 0 THEN
    IF EXISTS (SELECT 1 FROM public.bank_movements WHERE account_id = NEW.id AND origin = 'saldo_inicial') THEN
      UPDATE public.bank_movements
        SET amount = NEW.initial_balance,
            description = 'Saldo inicial — ' || NEW.name
        WHERE account_id = NEW.id AND origin = 'saldo_inicial';
    ELSE
      INSERT INTO public.bank_movements
        (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin)
      VALUES (
        NEW.user_id, NEW.empresa_id, NEW.id, COALESCE(NEW.created_at::date, now()::date),
        'entrada', 'Saldo inicial',
        'Saldo inicial — ' || NEW.name,
        NEW.initial_balance, 'saldo_inicial'
      );
    END IF;
  ELSIF NEW.initial_balance IS NULL OR NEW.initial_balance = 0 THEN
    DELETE FROM public.bank_movements WHERE account_id = NEW.id AND origin = 'saldo_inicial';
  END IF;
  RETURN NEW;
END;
$$;

-- source: 20260617161918_a19b5592-77d4-42d5-a75e-1be43b952e9f.sql | final function name: public.restore_stock_on_sale_item_delete
CREATE OR REPLACE FUNCTION public.restore_stock_on_sale_item_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.products
    SET stock = stock + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id AND user_id = OLD.user_id;
  RETURN OLD;
END; $$;

-- source: 20260813190516_7eda3ba4-0e2f-472b-9495-749372322d5d.sql | final function name: public.sale_status_to_finance
CREATE OR REPLACE FUNCTION public.sale_status_to_finance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE cust_name text; r_id uuid;
BEGIN
  -- NEW.empresa_id é mandatário
  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_id obrigatório em sales para gerar fluxos financeiros';
  END IF;

  -- Cenário: Recursos Financeiros (Aporte)
  IF NEW.channel = 'recursos_financeiros' THEN
    IF NEW.status IN ('confirmado','entregue')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
       AND NEW.bank_account_id IS NOT NULL
       AND NEW.total > 0
       AND COALESCE(NEW.bank_movement_generated, false) = false
       AND NOT EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='aporte' AND reference_id = NEW.id)
    THEN
      SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id AND empresa_id = NEW.empresa_id;
      
      INSERT INTO public.bank_movements (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
      VALUES (
        NEW.user_id, 
        NEW.empresa_id,
        NEW.bank_account_id, 
        COALESCE(NEW.sold_at::date, now()::date),
        'entrada', 
        'Aporte/Recurso Financeiro',
        COALESCE(cust_name, NEW.customer_name, 'Aporte') || ' — ' || COALESCE(NEW.aporte_type, 'recurso'),
        NEW.total, 
        'aporte', 
        NEW.id
      );
      UPDATE public.sales SET bank_movement_generated = true WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- Cenário: Venda Entregue
  IF NEW.status = 'entregue' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'entregue') THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id AND empresa_id = NEW.empresa_id;
    SELECT id INTO r_id FROM public.receivables WHERE sale_id = NEW.id LIMIT 1;
    
    IF r_id IS NOT NULL THEN
      UPDATE public.receivables
        SET received_amount = amount,
            status = 'recebido',
            received_at = COALESCE(received_at, now())
        WHERE id = r_id AND COALESCE(received_amount,0) < amount AND empresa_id = NEW.empresa_id;
    ELSIF NEW.bank_account_id IS NOT NULL
          AND NEW.total > 0
          AND COALESCE(NEW.bank_movement_generated, false) = false THEN
      IF NOT EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='sale' AND reference_id = NEW.id) THEN
        INSERT INTO public.bank_movements (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
        VALUES (
          NEW.user_id, 
          NEW.empresa_id,
          NEW.bank_account_id, 
          COALESCE(NEW.sold_at::date, now()::date),
          'entrada', 
          'Recebimento de venda',
          'Venda — ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
          NEW.total, 
          'sale', 
          NEW.id
        );
        UPDATE public.sales SET bank_movement_generated = true WHERE id = NEW.id;
      END IF;
    END IF;
    
  -- Cenário: Cancelamento
  ELSIF NEW.status = 'cancelado' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'cancelado' THEN
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id AND empresa_id = NEW.empresa_id;
    
    UPDATE public.receivables SET status='cancelado' 
    WHERE sale_id = NEW.id AND status <> 'cancelado' AND empresa_id = NEW.empresa_id;
    
    IF EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='sale' AND reference_id = NEW.id AND empresa_id = NEW.empresa_id)
       AND NOT EXISTS (SELECT 1 FROM public.bank_movements WHERE origin='sale_cancellation' AND reference_id = NEW.id AND empresa_id = NEW.empresa_id) THEN
      
      INSERT INTO public.bank_movements (user_id, empresa_id, account_id, movement_date, type, category, description, amount, origin, reference_id)
      SELECT 
        NEW.user_id, 
        NEW.empresa_id,
        account_id, 
        now()::date, 
        'saida', 
        'Estorno de venda',
        'Estorno — ' || COALESCE(cust_name, NEW.customer_name, 'balcão'),
        amount, 
        'sale_cancellation', 
        NEW.id
      FROM public.bank_movements 
      WHERE origin='sale' AND reference_id = NEW.id AND empresa_id = NEW.empresa_id;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- source: 20260619184948_90fa7661-9a75-4b9b-a8c2-e1c4d608f565.sql | final function name: public.seed_default_categorias_contas_pagar
CREATE OR REPLACE FUNCTION public.seed_default_categorias_contas_pagar(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.categorias_contas_pagar (user_id, nome, padrao) VALUES
    (_user_id, 'Fornecedor', true),
    (_user_id, 'Logística', true),
    (_user_id, 'Marketing', true),
    (_user_id, 'Aluguel', true),
    (_user_id, 'Impostos', true),
    (_user_id, 'Cartão de Crédito', true),
    (_user_id, 'Outros', true)
  ON CONFLICT (user_id, nome) DO NOTHING;
END;
$function$;

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final function name: public.sync_sale_total_to_finance
CREATE OR REPLACE FUNCTION public.sync_sale_total_to_finance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  r_rec public.receivables%ROWTYPE;
BEGIN
  IF NEW.total IS DISTINCT FROM OLD.total THEN
    UPDATE public.bank_movements SET amount = NEW.total
      WHERE origin = 'sale' AND reference_id = NEW.id;

    UPDATE public.receivables SET amount = NEW.total
      WHERE sale_id = NEW.id AND COALESCE(received_amount, 0) = 0;

    FOR r_rec IN
      SELECT * FROM public.receivables
       WHERE sale_id = NEW.id AND COALESCE(received_amount,0) > 0
    LOOP
      UPDATE public.receivables
         SET amount = NEW.total, received_amount = NEW.total
       WHERE id = r_rec.id;
      UPDATE public.bank_movements SET amount = NEW.total
       WHERE origin = 'receivable' AND reference_id = r_rec.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- source: 20260809120627_146e213c-f1e0-4e4b-ba8a-7fc708dd9eac.sql | final function name: public.log_audit
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user uuid;
  v_empresa_id uuid;
  v_row_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_row_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
    -- Tenta capturar empresa_id do OLD se existir
    BEGIN v_empresa_id := OLD.empresa_id; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user := NEW.user_id;
    v_row_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    BEGIN v_empresa_id := NEW.empresa_id; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
  ELSE
    v_user := NEW.user_id;
    v_row_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
    BEGIN v_empresa_id := NEW.empresa_id; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
  END IF;

  -- Verifica se audit_log tem a coluna empresa_id (deveria ter sido expandida na Wave A)
  -- Se não tiver, o INSERT falhará ou ignorará, mas aqui garantimos o preenchimento caso exista.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_log' AND column_name = 'empresa_id'
  ) THEN
      INSERT INTO public.audit_log (user_id, empresa_id, table_name, op, row_id, old_data, new_data)
      VALUES (v_user, v_empresa_id, TG_TABLE_NAME, TG_OP, v_row_id, v_old, v_new);
  ELSE
      INSERT INTO public.audit_log (user_id, table_name, op, row_id, old_data, new_data)
      VALUES (v_user, TG_TABLE_NAME, TG_OP, v_row_id, v_old, v_new);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- source: 20260813190900_rpc_registrar_venda_atomica_fix_v2.sql | final function name: public.sync_cvd_from_sale
CREATE OR REPLACE FUNCTION public.sync_cvd_from_sale(_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  s public.sales%ROWTYPE;
  v_subtotal numeric(12,2);
  v_cost numeric(12,2);
  v_frete_cli numeric(12,2);
  v_frete_emp numeric(12,2);
  v_loja numeric(12,2);
  v_juros numeric(12,2);
  v_lucro numeric(12,2);
  v_date date;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND THEN
    DELETE FROM public.controle_vendas_diario WHERE sale_id = _sale_id;
    RETURN;
  END IF;

  IF s.status <> 'entregue' OR s.channel = 'recursos_financeiros' THEN
    DELETE FROM public.controle_vendas_diario 
      WHERE sale_id = _sale_id AND origem = 'venda_automatica';
    RETURN;
  END IF;

  SELECT COALESCE(SUM(unit_price*quantity),0)
    INTO v_subtotal
    FROM public.sale_items WHERE sale_id = _sale_id;

  WITH avg_net AS (
    SELECT ci.produto_id,
           SUM(ci.quantidade * ci.preco_unitario
                * CASE WHEN COALESCE(c.subtotal,0) > 0 
                       THEN GREATEST(1 - COALESCE(c.desconto,0)/c.subtotal, 0)
                       ELSE 1 END)
             / NULLIF(SUM(ci.quantidade),0) AS net_cost
      FROM public.compras_itens ci
      JOIN public.compras c ON c.id = ci.compra_id
     WHERE ci.empresa_id = s.empresa_id -- Filtro por empresa_id
     GROUP BY ci.produto_id
  )
  SELECT COALESCE(SUM(
           si.quantity * COALESCE(an.net_cost, si.unit_cost)
         ), 0)
    INTO v_cost
    FROM public.sale_items si
    LEFT JOIN avg_net an ON an.produto_id = si.product_id
   WHERE si.sale_id = _sale_id;

  v_loja := s.total;
  v_juros := COALESCE(s.mercado_pago_fees, 0);
  v_frete_emp := COALESCE(s.frete_empresa, 0);
  v_frete_cli := GREATEST(s.total - (v_subtotal - COALESCE(s.discount,0)) + v_juros, 0);
  v_date := s.sold_at::date;
  v_lucro := v_loja - v_cost - v_juros - v_frete_emp;

  DELETE FROM public.controle_vendas_diario WHERE sale_id = _sale_id;

  INSERT INTO public.controle_vendas_diario
    (user_id, empresa_id, data, mes, ano, loja, custo, juros_ml, frete_empresa, frete_cliente, 
     receber, rateio, lucro, origem, sale_id)
  VALUES
    (s.user_id, s.empresa_id, v_date, EXTRACT(MONTH FROM v_date)::int, EXTRACT(YEAR FROM v_date)::int,
     v_loja, v_cost, v_juros, v_frete_emp, v_frete_cli, v_loja, 0, v_lucro,
     'venda_automatica', _sale_id);
END;
$function$;

-- source: 20260620162259_98a46119-7d6b-4770-9c89-e0d6c7ff6e6e.sql | final function name: public.tg_sale_sync_cvd
CREATE OR REPLACE FUNCTION public.tg_sale_sync_cvd()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.controle_vendas_diario WHERE sale_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.sync_cvd_from_sale(NEW.id);
  RETURN NEW;
END; $$;

-- source: 20260620162259_98a46119-7d6b-4770-9c89-e0d6c7ff6e6e.sql | final function name: public.tg_sale_items_sync_cvd
CREATE OR REPLACE FUNCTION public.tg_sale_items_sync_cvd()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_cvd_from_sale(OLD.sale_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_cvd_from_sale(NEW.sale_id);
  RETURN NEW;
END; $$;

-- source: 20260727202639_2e3f867d-cdde-479d-900f-36f7291c0c7c.sql | final function name: public.rpc_editar_compra_pendente
CREATE OR REPLACE FUNCTION public.rpc_editar_compra_pendente(_compra_id uuid, _expected_updated_at timestamp with time zone, _fornecedor_id uuid, _data_compra date, _numero_nf text, _condicao text, _parcelas integer, _data_primeira date, _desconto numeric, _frete numeric, _observacoes text, _itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_compra public.compras%ROWTYPE;
  v_short text;
  v_pattern text;
  v_forn_name text;
  v_base_desc text;
  v_item jsonb;
  v_qty int;
  v_price_cents bigint;
  v_subtotal_cents bigint := 0;
  v_desc_cents bigint;
  v_frete_cents bigint;
  v_total_cents bigint;
  v_n int;
  v_base_cents bigint;
  v_rem bigint;
  v_pay_ids uuid[];
  v_pay_count int;
  v_i int;
  v_anchor_day int;
  v_month_start date;
  v_last_day int;
  v_due date;
  v_amount_cents bigint;
  v_new_desc text;
  v_prod record;
  v_new_stock int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '42501';
  END IF;

  -- OPTIMISTIC LOCK OBRIGATÓRIO
  IF _expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'CONFLITO_UPDATED_AT';
  END IF;

  IF _condicao NOT IN ('a_prazo','parcelado') THEN
    RAISE EXCEPTION 'condicao_invalida';
  END IF;

  -- Trava compra
  SELECT * INTO v_compra FROM public.compras
   WHERE id = _compra_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'compra_nao_encontrada'; END IF;
  IF v_compra.status <> 'confirmada' THEN RAISE EXCEPTION 'status_incompativel'; END IF;

  -- Comparação obrigatória
  IF v_compra.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'CONFLITO_UPDATED_AT';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = _fornecedor_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'fornecedor_invalido';
  END IF;

  IF _itens IS NULL OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'sem_itens';
  END IF;

  -- Trava itens antigos
  PERFORM 1 FROM public.compras_itens
    WHERE compra_id = _compra_id AND user_id = v_uid
    FOR UPDATE;

  -- Validação e cálculo do subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_qty := (v_item->>'quantidade')::int;
    IF v_qty IS NULL OR v_qty < 1 THEN RAISE EXCEPTION 'quantidade_invalida'; END IF;
    IF (v_item->>'quantidade')::numeric <> v_qty THEN RAISE EXCEPTION 'quantidade_nao_inteira'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products
                    WHERE id = (v_item->>'produto_id')::uuid AND user_id = v_uid) THEN
      RAISE EXCEPTION 'produto_invalido';
    END IF;
    v_price_cents := round((v_item->>'preco_unitario')::numeric * 100)::bigint;
    IF v_price_cents < 0 THEN RAISE EXCEPTION 'preco_invalido'; END IF;
    IF round((v_item->>'preco_unitario')::numeric * 100) <> (v_item->>'preco_unitario')::numeric * 100 THEN
      RAISE EXCEPTION 'preco_com_precisao_excedida';
    END IF;
    v_subtotal_cents := v_subtotal_cents + v_price_cents * v_qty;
  END LOOP;

  v_desc_cents := round(COALESCE(_desconto,0) * 100)::bigint;
  v_frete_cents := round(COALESCE(_frete,0) * 100)::bigint;
  IF v_desc_cents < 0 OR v_frete_cents < 0 THEN RAISE EXCEPTION 'valores_invalidos'; END IF;
  IF v_desc_cents > v_subtotal_cents THEN RAISE EXCEPTION 'desconto_maior_que_subtotal'; END IF;
  v_total_cents := v_subtotal_cents - v_desc_cents + v_frete_cents;
  IF v_total_cents < 0 THEN RAISE EXCEPTION 'total_negativo'; END IF;

  -- Reconciliação de estoque com lock determinístico
  PERFORM p.id FROM public.products p
   WHERE p.user_id = v_uid
     AND p.id IN (
       SELECT ci.produto_id FROM public.compras_itens ci
         WHERE ci.compra_id = _compra_id AND ci.user_id = v_uid
       UNION
       SELECT (elem->>'produto_id')::uuid
         FROM jsonb_array_elements(_itens) AS elem
     )
   ORDER BY p.id
   FOR UPDATE;

  FOR v_prod IN
    WITH antigos AS (
      SELECT produto_id, SUM(quantidade)::int AS qtd
        FROM public.compras_itens
       WHERE compra_id = _compra_id AND user_id = v_uid
       GROUP BY produto_id
    ),
    novos AS (
      SELECT (elem->>'produto_id')::uuid AS produto_id,
             SUM((elem->>'quantidade')::int)::int AS qtd
        FROM jsonb_array_elements(_itens) AS elem
       GROUP BY (elem->>'produto_id')::uuid
    ),
    todos AS (
      SELECT produto_id FROM antigos
      UNION
      SELECT produto_id FROM novos
    )
    SELECT t.produto_id,
           COALESCE(n.qtd,0) - COALESCE(a.qtd,0) AS delta
      FROM todos t
      LEFT JOIN antigos a ON a.produto_id = t.produto_id
      LEFT JOIN novos   n ON n.produto_id = t.produto_id
     ORDER BY t.produto_id
  LOOP
    IF v_prod.delta <> 0 THEN
      SELECT stock + v_prod.delta INTO v_new_stock
        FROM public.products
       WHERE id = v_prod.produto_id AND user_id = v_uid;
      IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE_PARA_REDUCAO_DA_COMPRA';
      END IF;
      UPDATE public.products
         SET stock = v_new_stock, updated_at = now()
       WHERE id = v_prod.produto_id AND user_id = v_uid;
    END IF;
  END LOOP;

  -- Localiza parcelas (owner-safe: filtra por user_id)
  v_short := substring(v_compra.id::text, 1, 8);
  v_pattern := 'Compra #' || v_short || ' —%';

  -- LOCK OBRIGATÓRIO das payables antes de validação/DELETE
  -- V2: separa o lock (FOR UPDATE) da agregação (array_agg) para evitar SQLSTATE 0A000
  WITH locked AS MATERIALIZED (
    SELECT id, due_date
      FROM public.payables
     WHERE user_id = v_uid
       AND description LIKE v_pattern
     ORDER BY due_date, id
     FOR UPDATE
  )
  SELECT COALESCE(array_agg(id ORDER BY due_date, id), ARRAY[]::uuid[])
    INTO v_pay_ids
    FROM locked;

  v_pay_count := COALESCE(array_length(v_pay_ids,1), 0);

  IF v_pay_count = 0 THEN
    RAISE EXCEPTION 'parcelas_nao_encontradas';
  END IF;

  IF v_pay_count <> COALESCE(v_compra.parcelas, 1) THEN
    RAISE EXCEPTION 'correspondencia_ambigua_ou_incompleta';
  END IF;

  -- Revalida estado das payables JÁ TRAVADAS (concorrência bloqueada)
  IF EXISTS (
    SELECT 1 FROM public.payables
     WHERE id = ANY(v_pay_ids)
       AND (status <> 'pendente' OR COALESCE(paid_amount,0) > 0 OR bank_account_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'payables_incompativeis';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bank_movements
     WHERE origin = 'payable' AND reference_id = ANY(v_pay_ids)
  ) THEN
    RAISE EXCEPTION 'movimento_bancario_existente';
  END IF;

  SELECT name INTO v_forn_name FROM public.suppliers WHERE id = _fornecedor_id;
  v_base_desc := 'Compra #' || v_short || ' — ' || COALESCE(v_forn_name,'Fornecedor')
                 || CASE WHEN NULLIF(_numero_nf,'') IS NOT NULL THEN ' NF ' || _numero_nf ELSE '' END;

  UPDATE public.compras SET
    fornecedor_id = _fornecedor_id,
    data_compra = _data_compra,
    numero_nf = NULLIF(_numero_nf,''),
    condicao_pagamento = _condicao,
    forma_pagamento = NULL,
    bank_account_id = NULL,
    parcelas = CASE WHEN _condicao = 'parcelado' THEN GREATEST(_parcelas,1) ELSE 1 END,
    dia_vencimento = CASE WHEN _condicao = 'parcelado' THEN EXTRACT(day FROM _data_primeira)::int ELSE NULL END,
    data_vencimento = _data_primeira,
    subtotal = v_subtotal_cents::numeric / 100,
    desconto = v_desc_cents::numeric / 100,
    frete = v_frete_cents::numeric / 100,
    total = v_total_cents::numeric / 100,
    observacoes = NULLIF(_observacoes,''),
    updated_at = now()
  WHERE id = _compra_id;

  DELETE FROM public.compras_itens WHERE compra_id = _compra_id AND user_id = v_uid;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_qty := (v_item->>'quantidade')::int;
    v_price_cents := round((v_item->>'preco_unitario')::numeric * 100)::bigint;
    INSERT INTO public.compras_itens (user_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_uid, _compra_id, (v_item->>'produto_id')::uuid, v_qty,
            v_price_cents::numeric / 100, (v_price_cents * v_qty)::numeric / 100);
  END LOOP;

  DELETE FROM public.payables WHERE id = ANY(v_pay_ids);

  IF _condicao = 'parcelado' THEN
    v_n := GREATEST(_parcelas, 1);
    v_base_cents := v_total_cents / v_n;
    v_rem := v_total_cents - v_base_cents * v_n;
    v_anchor_day := EXTRACT(day FROM _data_primeira)::int;
    FOR v_i IN 0 .. v_n - 1 LOOP
      v_month_start := (date_trunc('month', _data_primeira) + (v_i || ' months')::interval)::date;
      v_last_day := EXTRACT(day FROM (v_month_start + interval '1 month - 1 day'))::int;
      v_due := v_month_start + (LEAST(v_anchor_day, v_last_day) - 1);
      v_amount_cents := v_base_cents + CASE WHEN v_i < v_rem THEN 1 ELSE 0 END;
      v_new_desc := v_base_desc || ' (' || (v_i + 1) || '/' || v_n || ')';
      INSERT INTO public.payables (user_id, supplier_id, description, category, amount, due_date, status)
      VALUES (v_uid, _fornecedor_id, v_new_desc, 'Fornecedor',
              v_amount_cents::numeric / 100, v_due, 'pendente');
    END LOOP;
  ELSE
    INSERT INTO public.payables (user_id, supplier_id, description, category, amount, due_date, status)
    VALUES (v_uid, _fornecedor_id, v_base_desc, 'Fornecedor',
            v_total_cents::numeric / 100, _data_primeira, 'pendente');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'compra_id', _compra_id,
    'parcelas_recriadas', CASE WHEN _condicao = 'parcelado' THEN GREATEST(_parcelas,1) ELSE 1 END,
    'total', v_total_cents::numeric / 100
  );
END;
$function$;

-- source: 20260806233459_a83cf1c9-b550-46d1-8a08-d50eccec8da8.sql | final function name: public.has_role_in_company
CREATE OR REPLACE FUNCTION public.has_role_in_company(_user_id UUID, _empresa_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_access
    WHERE user_id = _user_id
      AND empresa_id = _empresa_id
      AND (role = _role OR role = 'admin')
      AND status = 'active'
  )
$$;

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | final function name: public.accept_company_invitation
CREATE OR REPLACE FUNCTION public.accept_company_invitation(_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_invitation_id UUID;
    v_empresa_id UUID;
    v_role public.app_role;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    SELECT id, empresa_id, role INTO v_invitation_id, v_empresa_id, v_role
    FROM public.company_invitations
    WHERE token_hash = _token_hash
      AND status = 'pending'
      AND expires_at > now();

    IF v_invitation_id IS NULL THEN
        RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado';
    END IF;

    -- Criar o acesso
    INSERT INTO public.user_company_access (user_id, empresa_id, role)
    VALUES (v_user_id, v_empresa_id, v_role)
    ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active';

    -- Marcar convite como aceito
    UPDATE public.company_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invitation_id;

    RETURN TRUE;
END;
$$;

-- source: 20260807012502_916754ea-bbd1-4456-afe6-55ad546b9e40.sql | final function name: public.get_my_multiempresa_context
CREATE OR REPLACE FUNCTION public.get_my_multiempresa_context()
RETURNS TABLE (
    empresa_id UUID,
    nome TEXT,
    razao_social TEXT,
    tipo TEXT,
    role public.app_role,
    status TEXT,
    is_primary BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as empresa_id,
        e.nome,
        e.razao_social,
        e.tipo,
        uca.role,
        uca.status,
        uca.is_primary
    FROM public.empresas e
    JOIN public.user_company_access uca ON e.id = uca.empresa_id
    WHERE uca.user_id = auth.uid()
      AND uca.status = 'active';
END;
$$;

-- source: 20260807013629_9cb1c7e1-0808-418d-9197-5a4eccb28a0f.sql | final function name: public.list_my_company_members
CREATE OR REPLACE FUNCTION public.list_my_company_members(p_empresa_id uuid)
RETURNS TABLE (
    user_id UUID,
    role public.app_role,
    status TEXT,
    is_primary BOOLEAN,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Validar internamente que auth.uid() possui membership ativo e papel admin na empresa solicitada
    IF NOT EXISTS (
        SELECT 1 
        FROM public.user_company_access 
        WHERE user_company_access.user_id = auth.uid() 
          AND user_company_access.empresa_id = p_empresa_id 
          AND user_company_access.role = 'admin' 
          AND user_company_access.status = 'active'
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        uca.user_id,
        uca.role,
        uca.status,
        uca.is_primary,
        uca.created_at
    FROM public.user_company_access uca
    WHERE uca.empresa_id = p_empresa_id;
END;
$$;

-- source: 20260807222045_4c51f9a1-8aae-420e-896b-d247b76e118b.sql | final function name: public.get_auth_rate_limit_status
CREATE OR REPLACE FUNCTION public.get_auth_rate_limit_status(
    p_scope TEXT,
    p_identity_kind TEXT,
    p_identity_hash TEXT
)
RETURNS TABLE (
    is_blocked BOOLEAN,
    retry_after_seconds INTEGER,
    failure_count INTEGER,
    escalation_level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_blocked_until TIMESTAMPTZ;
    v_failure_count INTEGER;
    v_escalation_level INTEGER;
BEGIN
    SELECT blocked_until, auth_rate_limits.failure_count, auth_rate_limits.escalation_level
    INTO v_blocked_until, v_failure_count, v_escalation_level
    FROM auth_rate_limits
    WHERE scope = p_scope
      AND identity_kind = p_identity_kind
      AND identity_hash = p_identity_hash;

    IF FOUND AND v_blocked_until IS NOT NULL AND v_blocked_until > v_now THEN
        RETURN QUERY SELECT 
            TRUE, 
            ceil(extract(epoch from (v_blocked_until - v_now)))::INTEGER,
            v_failure_count,
            v_escalation_level;
    ELSE
        RETURN QUERY SELECT FALSE, 0, COALESCE(v_failure_count, 0), COALESCE(v_escalation_level, 0);
    END IF;
END;
$$;

-- source: 20260807222045_4c51f9a1-8aae-420e-896b-d247b76e118b.sql | final function name: public.record_auth_failure
CREATE OR REPLACE FUNCTION public.record_auth_failure(
    p_scope TEXT,
    p_identity_kind TEXT,
    p_identity_hash TEXT,
    p_limit INTEGER,
    p_cooldown_minutes INTEGER[],
    p_window_ms INTEGER
)
RETURNS TABLE (
    retry_after_seconds INTEGER,
    new_failure_count INTEGER,
    new_escalation_level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_record RECORD;
    v_new_failure_count INTEGER;
    v_new_escalation_level INTEGER;
    v_new_blocked_until TIMESTAMPTZ := NULL;
    v_cooldown_min INTEGER;
BEGIN
    INSERT INTO auth_rate_limits (
        scope, identity_kind, identity_hash, failure_count, escalation_level, 
        window_started_at, last_attempt_at, expires_at
    )
    VALUES (
        p_scope, p_identity_kind, p_identity_hash, 1, 0, 
        v_now, v_now, v_now + (p_window_ms || ' milliseconds')::INTERVAL + interval '1 hour'
    )
    ON CONFLICT (scope, identity_kind, identity_hash)
    DO UPDATE SET
        failure_count = CASE 
            WHEN auth_rate_limits.window_started_at + (p_window_ms || ' milliseconds')::INTERVAL < v_now 
            THEN 1 
            ELSE auth_rate_limits.failure_count + 1 
        END,
        window_started_at = CASE 
            WHEN auth_rate_limits.window_started_at + (p_window_ms || ' milliseconds')::INTERVAL < v_now 
            THEN v_now 
            ELSE auth_rate_limits.window_started_at 
        END,
        last_attempt_at = v_now,
        updated_at = v_now,
        expires_at = v_now + interval '24 hours'
    RETURNING * INTO v_record;

    v_new_failure_count := v_record.failure_count;
    v_new_escalation_level := v_record.escalation_level;

    IF v_new_failure_count >= p_limit THEN
        -- Escalonamento progressivo
        v_cooldown_min := p_cooldown_minutes[LEAST(v_new_escalation_level + 1, array_length(p_cooldown_minutes, 1))];
        v_new_blocked_until := v_now + (v_cooldown_min || ' minutes')::INTERVAL;
        
        UPDATE auth_rate_limits
        SET blocked_until = v_new_blocked_until,
            escalation_level = escalation_level + 1,
            failure_count = 0, -- Reset count after block
            window_started_at = v_new_blocked_until
        WHERE id = v_record.id;
        
        RETURN QUERY SELECT ceil(extract(epoch from (v_new_blocked_until - v_now)))::INTEGER, 0, v_new_escalation_level + 1;
    ELSE
        RETURN QUERY SELECT 0, v_new_failure_count, v_new_escalation_level;
    END IF;
END;
$$;

-- source: 20260807222045_4c51f9a1-8aae-420e-896b-d247b76e118b.sql | final function name: public.reset_auth_rate_limit
CREATE OR REPLACE FUNCTION public.reset_auth_rate_limit(
    p_scope TEXT,
    p_identity_kind TEXT,
    p_identity_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    DELETE FROM auth_rate_limits
    WHERE scope = p_scope
      AND identity_kind = p_identity_kind
      AND identity_hash = p_identity_hash;
END;
$$;

-- source: 20260807222045_4c51f9a1-8aae-420e-896b-d247b76e118b.sql | final function name: public.cleanup_expired_auth_rate_limits
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_rate_limits()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    DELETE FROM auth_rate_limits
    WHERE expires_at < now();
END;
$$;

-- source: 20260813173838_4ee7a7ca-e540-4b92-a5d2-346ae1bec401.sql | final function name: public.create_pending_onboarding
CREATE OR REPLACE FUNCTION public.create_pending_onboarding(
    _nome_admin TEXT,
    _nome_empresa TEXT,
    _cnpj_formatado TEXT,
    _cnpj_limpo TEXT,
    _email_hash TEXT,
    _terms_version TEXT,
    _privacy_version TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    new_emp_id UUID;
BEGIN
    -- Verificar duplicidade antes de inserir
    IF EXISTS (SELECT 1 FROM public.empresas WHERE documento = _cnpj_limpo) THEN
        RAISE EXCEPTION 'COMPANY_ALREADY_EXISTS';
    END IF;

    -- Inserir empresa (owner_id será vinculado depois via link_auth_user_to_onboarding ou similar)
    -- Por enquanto, usamos um placeholder ou permitimos null se a estrutura permitir, 
    -- mas a Wave A exige owner_id NOT NULL.
    -- Vamos ajustar para aceitar o owner_id se já tivermos ou criar a empresa associada ao service_role temporariamente.
    
    INSERT INTO public.empresas (nome, documento, owner_id, status)
    VALUES (_nome_empresa, _cnpj_limpo, auth.uid(), 'active')
    RETURNING id INTO new_emp_id;

    RETURN new_emp_id;
END;
$$;

-- source: 20260807224646_3a0e178a-3af3-4776-aed1-dc7695a9136a.sql | final function name: public.link_auth_user_to_onboarding
CREATE OR REPLACE FUNCTION public.link_auth_user_to_onboarding(
    p_onboarding_id UUID,
    p_auth_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    UPDATE pending_onboardings
    SET auth_user_id = p_auth_user_id,
        updated_at = now()
    WHERE id = p_onboarding_id
      AND status = 'pending';
END;
$$;

-- source: 20260807224646_3a0e178a-3af3-4776-aed1-dc7695a9136a.sql | final function name: public.cancel_pending_onboarding
CREATE OR REPLACE FUNCTION public.cancel_pending_onboarding(
    p_onboarding_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    UPDATE pending_onboardings
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = p_onboarding_id;
END;
$$;

-- source: 20260807232410_d0c1b93b-17b2-4354-b954-f80d8e852e6a.sql | final function name: public.finalize_user_onboarding
CREATE OR REPLACE FUNCTION public.finalize_user_onboarding(
    p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_onboarding RECORD;
    v_empresa_id UUID;
    v_onboarding_count INTEGER;
BEGIN
    -- 1. Contar reservas pendentes e válidas para o usuário
    SELECT COUNT(*) INTO v_onboarding_count
    FROM pending_onboardings
    WHERE auth_user_id = p_auth_user_id
      AND status = 'pending'
      AND expires_at > now();

    -- 2. Validar multiplicidade (Segurança Hardened)
    IF v_onboarding_count = 0 THEN
        -- Verificar se já foi ativado (idempotência)
        IF EXISTS (
            SELECT 1 FROM pending_onboardings 
            WHERE auth_user_id = p_auth_user_id AND status = 'activated'
        ) THEN
            RETURN jsonb_build_object('success', true, 'message', 'Onboarding já concluído anteriormente.');
        END IF;
        RAISE EXCEPTION 'Nenhuma reserva de onboarding pendente e válida encontrada.';
    ELSIF v_onboarding_count > 1 THEN
        RAISE EXCEPTION 'Múltiplas reservas pendentes detectadas para o mesmo usuário. Bloqueio de segurança ativado.';
    END IF;

    -- 3. Selecionar a reserva com row lock
    SELECT * INTO v_onboarding
    FROM pending_onboardings
    WHERE auth_user_id = p_auth_user_id
      AND status = 'pending'
      AND expires_at > now()
    FOR UPDATE;

    -- 4. Criar a Empresa
    INSERT INTO public.empresas (nome, razao_social, cnpj, configuracoes)
    VALUES (
        v_onboarding.nome_empresa,
        v_onboarding.nome_empresa,
        v_onboarding.cnpj_limpo,
        jsonb_build_object('onboarding_completed_at', now())
    )
    RETURNING id INTO v_empresa_id;

    -- 5. Perfil
    INSERT INTO public.profiles (id, email, full_name, empresa_id, updated_at)
    SELECT p_auth_user_id, u.email, v_onboarding.nome_admin, v_empresa_id, now()
    FROM auth.users u WHERE u.id = p_auth_user_id
    ON CONFLICT (id) DO UPDATE SET
        empresa_id = v_empresa_id,
        full_name = v_onboarding.nome_admin,
        updated_at = now();

    -- 6. Acesso
    INSERT INTO public.user_company_access (user_id, empresa_id, role, status)
    VALUES (p_auth_user_id, v_empresa_id, 'admin', 'active')
    ON CONFLICT (user_id, empresa_id) DO NOTHING;

    -- 7. Hardening: Marcar reserva como ativada
    UPDATE pending_onboardings
    SET status = 'activated', updated_at = now()
    WHERE id = v_onboarding.id;

    RETURN jsonb_build_object('success', true, 'empresa_id', v_empresa_id);

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Falha na finalização do onboarding: %', SQLERRM;
END;
$$;

-- source: 20260808190000_fix_reconcile_onboarding_contract_repair.sql | final function name: public.ensure_empresa_defaults
CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(_empresa_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    -- Provision default categories (idempotent via ON CONFLICT)
    -- Column 'updated_at' does NOT exist in categorias_contas_pagar
    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES ('Mercadorias para Revenda', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;

    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES ('Serviços Tomados', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;
END;
$function$;

-- source: 20260809233430_5eee05ad-70ac-4b67-9605-5da264560374.sql | final function name: public.can_company_invite_member
CREATE OR REPLACE FUNCTION public.can_company_invite_member(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_max_users INTEGER;
    v_active_members INTEGER;
    v_pending_invites INTEGER;
    v_total_reserved INTEGER;
BEGIN
    -- Get plan limit from the current active subscription
    SELECT p.max_users INTO v_max_users
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.empresa_id = p_empresa_id
      AND s.status NOT IN ('canceled', 'incomplete_expired')
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- Default fallback
    IF NOT FOUND THEN v_max_users := 5; END IF;

    -- Count active memberships
    SELECT count(*) INTO v_active_members
    FROM public.user_company_access
    WHERE empresa_id = p_empresa_id AND status = 'active';

    -- Count pending invitations (if table exists, else 0)
    BEGIN
        EXECUTE 'SELECT count(*) FROM public.company_invitations WHERE empresa_id = $1 AND status = ''pending'' AND expires_at > now()'
        INTO v_pending_invites
        USING p_empresa_id;
    EXCEPTION WHEN OTHERS THEN
        v_pending_invites := 0;
    END;

    v_total_reserved := v_active_members + v_pending_invites;

    IF v_total_reserved >= v_max_users THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current', v_total_reserved,
            'limit', v_max_users,
            'message', 'Limite de ' || v_max_users || ' usuários atingido.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true, 
        'current', v_total_reserved, 
        'limit', v_max_users, 
        'message', 'Permitido.'
    );
END;
$$;

-- source: 20260808222344_dd68d434-3681-4e14-babd-548632183dd5.sql | final function name: public.get_company_subscription_context_admin
CREATE OR REPLACE FUNCTION public.get_company_subscription_context_admin(
    p_empresa_id uuid,
    p_verified_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_has_access boolean;
    v_sub record;
    v_plan record;
    v_user_count integer;
    v_access_mode text;
    v_days_remaining integer;
BEGIN
    -- Validação obrigatória de parâmetros
    IF p_empresa_id IS NULL OR p_verified_user_id IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters: p_empresa_id and p_verified_user_id are mandatory.';
    END IF;

    -- Validar membership active de p_verified_user_id em p_empresa_id
    -- Usando relações totalmente qualificadas para segurança adicional
    SELECT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = p_verified_user_id
          AND empresa_id = p_empresa_id
          AND status = 'active'
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        -- Falha fechada: se não for membro, retorna NULL ou erro silencioso
        -- Retornamos NULL para indicar "Sem acesso/Não encontrado"
        RETURN NULL;
    END IF;

    -- Buscar assinatura ativa (Isolation por empresa_id garantido pelo WHERE)
    SELECT 
        plan_id, 
        status, 
        trial_started_at, 
        trial_ends_at, 
        grace_ends_at, 
        current_period_started_at, 
        current_period_ends_at
    INTO v_sub
    FROM public.subscriptions
    WHERE empresa_id = p_empresa_id
      AND status NOT IN ('canceled', 'incomplete')
    LIMIT 1;

    -- Caso não tenha assinatura, retorna perfil básico 'none'
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'plan_code', 'none',
            'plan_name', 'Nenhum',
            'status', 'none',
            'access_mode', 'restricted',
            'days_remaining', 0,
            'current_user_count', 0,
            'max_users', 0,
            'can_invite_member', false,
            'priority_suggestions', false
        );
    END IF;

    -- Buscar detalhes do plano
    SELECT code, name, max_users, priority_suggestions
    INTO v_plan
    FROM public.plans
    WHERE id = v_sub.plan_id;

    -- Contagem de usuários ativos para validação de limites
    SELECT COUNT(*) INTO v_user_count
    FROM public.user_company_access
    WHERE empresa_id = p_empresa_id
      AND status = 'active';

    -- Lógica de modo de acesso e dias restantes (copiada da lógica comercial aprovada)
    IF v_sub.status = 'trialing' THEN
        v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.trial_ends_at - now()))::integer);
        v_access_mode := 'full';
    ELSIF v_sub.status = 'active' THEN
        v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.current_period_ends_at - now()))::integer);
        v_access_mode := 'full';
    ELSIF v_sub.status IN ('past_due', 'grace_read_only') THEN
        v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_sub.grace_ends_at - now()))::integer);
        v_access_mode := 'read_only';
    ELSIF v_sub.status = 'restricted' THEN
        v_days_remaining := 0;
        v_access_mode := 'billing_only';
    ELSE
        v_days_remaining := 0;
        v_access_mode := 'restricted';
    END IF;

    -- Retorno sanitizado (NÃO inclui IDs de produto/preço Stripe ou eventos de pagamento)
    RETURN jsonb_build_object(
        'plan_code', v_plan.code,
        'plan_name', v_plan.name,
        'status', v_sub.status,
        'trial_started_at', v_sub.trial_started_at,
        'trial_ends_at', v_sub.trial_ends_at,
        'grace_ends_at', v_sub.grace_ends_at,
        'current_period_ends_at', COALESCE(v_sub.current_period_ends_at, v_sub.trial_ends_at),
        'days_remaining', v_days_remaining,
        'access_mode', v_access_mode,
        'max_users', v_plan.max_users,
        'current_user_count', v_user_count,
        'can_invite_member', (v_user_count < v_plan.max_users AND v_access_mode = 'full'),
        'priority_suggestions', v_plan.priority_suggestions
    );
END;
$function$;

-- source: 20260812141554_9146bbb3-2d0d-4574-b580-5f63e990ab56.sql | final function name: public.reserve_checkout_attempt
CREATE OR REPLACE FUNCTION public.reserve_checkout_attempt(
    p_empresa_id UUID,
    p_subscription_id UUID,
    p_verified_user_id UUID,
    p_livemode BOOLEAN,
    p_provider TEXT DEFAULT 'stripe'
)
RETURNS public.checkout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_attempt public.checkout_attempts;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- VALIDATION (Membership & Sub Ownership)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE empresa_id = p_empresa_id AND user_id = p_verified_user_id 
          AND status = 'active' AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Forbidden: Admin membership required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.subscriptions 
        WHERE id = p_subscription_id AND empresa_id = p_empresa_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: Subscription mismatch';
    END IF;

    -- 1. Lock and check for existing valid attempt in the SAME environment
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE empresa_id = p_empresa_id 
      AND subscription_id = p_subscription_id
      AND livemode = p_livemode
      AND status IN ('creating', 'open')
      AND (expires_at IS NULL OR expires_at > v_now)
    FOR UPDATE;

    IF v_attempt.id IS NOT NULL THEN
        RETURN v_attempt;
    END IF;

    -- 2. Create new attempt
    INSERT INTO public.checkout_attempts (
        provider,
        empresa_id,
        subscription_id,
        created_by_user_id,
        livemode,
        idempotency_key,
        status,
        expires_at
    )
    VALUES (
        p_provider,
        p_empresa_id,
        p_subscription_id,
        p_verified_user_id,
        p_livemode,
        gen_random_uuid()::text,
        'creating',
        v_now + interval '24 hours'
    )
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

-- source: 20260809162532_05b6c199-a9e1-45a6-9e0a-c2fee9835e84.sql | final function name: public.finalize_checkout_attempt
CREATE OR REPLACE FUNCTION public.finalize_checkout_attempt(
    p_empresa_id UUID,
    p_subscription_id UUID,
    p_attempt_id UUID,
    p_provider_session_id TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS public.checkout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_attempt public.checkout_attempts;
BEGIN
    -- 1. Lock and validate the attempt exists, is for the correct company, and in 'creating' state
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE id = p_attempt_id
      AND empresa_id = p_empresa_id
      AND subscription_id = p_subscription_id
      AND status = 'creating'
    FOR UPDATE;

    IF v_attempt.id IS NULL THEN
        -- If already finalized (idempotency), return the existing row
        SELECT * INTO v_attempt
        FROM public.checkout_attempts
        WHERE id = p_attempt_id
          AND empresa_id = p_empresa_id;
        
        IF v_attempt.id IS NOT NULL THEN
            RETURN v_attempt;
        END IF;
        
        RAISE EXCEPTION 'Checkout attempt not found or already finalized in another state.';
    END IF;

    -- 2. Atomic update to 'open' status and sync session data
    UPDATE public.checkout_attempts
    SET status = 'open',
        provider_checkout_session_id = p_provider_session_id,
        expires_at = p_expires_at,
        updated_at = now()
    WHERE id = p_attempt_id
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

-- source: 20260809_stripe_checkout_session_persistence_contract_correction.sql | final function name: public.finalize_checkout_attempt_v2
CREATE OR REPLACE FUNCTION public.finalize_checkout_attempt_v2(
  p_attempt_id uuid,
  p_provider text,
  p_provider_checkout_session_id text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row_count int;
  v_empresa_id uuid;
  v_subscription_id uuid;
  v_current_status text;
  v_current_provider_session_id text;
BEGIN
  -- 1. Input validation
  IF p_attempt_id IS NULL OR p_provider IS NULL OR p_provider_checkout_session_id IS NULL OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'Parameters cannot be null';
  END IF;

  IF p_provider <> 'stripe' THEN
    RAISE EXCEPTION 'Invalid provider. Only stripe is supported.';
  END IF;

  IF p_provider_checkout_session_id = '' THEN
    RAISE EXCEPTION 'Provider session ID cannot be empty';
  END IF;

  -- 2. Lock attempt and derive context
  SELECT empresa_id, subscription_id, status, provider_checkout_session_id
  INTO v_empresa_id, v_subscription_id, v_current_status, v_current_provider_session_id
  FROM public.checkout_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout attempt not found';
  END IF;

  -- 3. Validate internal subscription belongs to the company
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE id = v_subscription_id AND empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Internal subscription mismatch';
  END IF;

  -- 4. State machine validation
  -- a. status='creating' and session_id null
  -- b. status='open' and session_id null (reconciliation case)
  -- c. status='open' with same session_id (idempotency)
  
  IF v_current_status = 'creating' AND v_current_provider_session_id IS NULL THEN
    -- Normal flow: first finalization
    NULL;
  ELSIF v_current_status = 'open' AND v_current_provider_session_id IS NULL THEN
    -- Reconciliation flow: existing open attempt without ID
    NULL;
  ELSIF v_current_status = 'open' AND v_current_provider_session_id = p_provider_checkout_session_id THEN
    -- Idempotency flow
    RETURN jsonb_build_object(
      'persisted', true,
      'attempt_id', p_attempt_id,
      'status', 'open',
      'provider_session_id_present', true
    );
  ELSE
    RAISE EXCEPTION 'Invalid state transition: status=%, session_id_present=%', v_current_status, (v_current_provider_session_id IS NOT NULL);
  END IF;

  -- 5. Atomic Update
  UPDATE public.checkout_attempts
  SET
    provider = p_provider,
    provider_checkout_session_id = p_provider_checkout_session_id,
    expires_at = p_expires_at,
    status = 'open',
    updated_at = now()
  WHERE id = p_attempt_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'Failed to update checkout attempt: row count %', v_row_count;
  END IF;

  RETURN jsonb_build_object(
    'persisted', true,
    'attempt_id', p_attempt_id,
    'status', 'open',
    'provider_session_id_present', true
  );
END;
$$;

-- source: 20260813151341_4ce9989b-c842-44de-afc1-4be63fb4d728.sql | final function name: public.process_stripe_webhook_event
CREATE OR REPLACE FUNCTION public.process_stripe_webhook_event(
    p_provider_event_id TEXT,
    p_event_type TEXT,
    p_payload_sha256 TEXT,
    p_livemode BOOLEAN,
    p_event_data JSONB,
    p_event_created BIGINT,
    p_canonical_plan_code TEXT DEFAULT 'enterprise_monthly',
    p_canonical_price_id TEXT DEFAULT NULL,
    p_canonical_currency TEXT DEFAULT 'brl',
    p_canonical_amount BIGINT DEFAULT 3590
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event_id UUID;
    v_internal_sub_id UUID;
    v_empresa_id UUID;
    v_object JSONB;
    v_metadata JSONB;
    v_event_priority INTEGER;
    v_last_event_created BIGINT;
    v_last_event_priority INTEGER;
    v_is_out_of_order BOOLEAN := FALSE;
    
    -- Extracted values for validation
    v_obs_price_id TEXT;
    v_obs_currency TEXT;
    v_obs_amount BIGINT;
    v_obs_plan_code TEXT;
    v_stripe_sub_id TEXT;
    v_stripe_customer_id TEXT;
    v_current_period_end BIGINT;
    v_existing_current_period_end TIMESTAMPTZ;
    v_existing_status TEXT;
    v_checkout_attempt_id UUID;
    v_provider_session_id TEXT;

    -- Local block variables for checkout.session.expired
    v_locked_attempt_id UUID;
    v_locked_empresa_id UUID;
    v_locked_subscription_id UUID;
    v_locked_status TEXT;
    
    -- Metadata validation variables
    v_meta_internal_sub_id UUID;
    v_meta_empresa_id UUID;
    v_meta_attempt_id UUID;
    v_meta_plan_code TEXT;
BEGIN
    -- 1. Security Check: Environment (MODIFIED: ALLOW LIVE MODE)
    -- IF p_livemode THEN
    --     RAISE EXCEPTION 'Livemode events are strictly prohibited.';
    -- END IF;

    -- 2. Idempotency (Strict)
    IF EXISTS (SELECT 1 FROM public.payment_events WHERE provider = 'stripe' AND provider_event_id = p_provider_event_id AND processing_status = 'processed') THEN
        RETURN jsonb_build_object('status', 'processed', 'reason', 'Duplicate event');
    END IF;

    -- 3. Priority Mapping
    v_event_priority := CASE p_event_type
        WHEN 'checkout.session.completed' THEN 10
        WHEN 'checkout.session.expired' THEN 15
        WHEN 'customer.subscription.created' THEN 20
        WHEN 'customer.subscription.updated' THEN 30
        WHEN 'invoice.payment_failed' THEN 40
        WHEN 'invoice.paid' THEN 50
        WHEN 'customer.subscription.deleted' THEN 60
        ELSE 100
    END;

    -- 4. Initial Record
    INSERT INTO public.payment_events (
        provider, provider_event_id, event_type, payload_sha256, 
        provider_event_created_at, processing_status
    )
    VALUES (
        'stripe', p_provider_event_id, p_event_type, p_payload_sha256, 
        p_event_created, 'processing'
    )
    ON CONFLICT (provider, provider_event_id) DO UPDATE 
    SET updated_at = now()
    RETURNING id INTO v_event_id;

    v_object := p_event_data->'object';
    v_metadata := v_object->'metadata';
    v_stripe_sub_id := v_object->>'subscription';
    v_provider_session_id := v_object->>'id';

    -- 5. BRANCH ESPECIALIZADO: checkout.session.expired
    IF p_event_type = 'checkout.session.expired' THEN
        IF v_provider_session_id IS NULL OR v_provider_session_id = '' THEN
            UPDATE public.payment_events SET processing_status = 'rejected_permanent', sanitized_error_code = 'MISSING_SESSION_ID' WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Missing Session ID');
        END IF;

        SELECT id, empresa_id, subscription_id, status
        INTO v_locked_attempt_id, v_locked_empresa_id, v_locked_subscription_id, v_locked_status
        FROM public.checkout_attempts
        WHERE provider = 'stripe' AND provider_checkout_session_id = v_provider_session_id
        FOR UPDATE;

        IF v_locked_attempt_id IS NULL THEN
            UPDATE public.payment_events SET processing_status = 'failed_retryable', sanitized_error_code = 'UNLINKED_SESSION' WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'failed_retryable', 'event_id', v_event_id);
        END IF;

        BEGIN
            v_meta_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
        EXCEPTION WHEN OTHERS THEN v_meta_internal_sub_id := NULL;
        END;
        BEGIN
            v_meta_empresa_id := (v_metadata->>'empresa_id')::UUID;
        EXCEPTION WHEN OTHERS THEN v_meta_empresa_id := NULL;
        END;
        BEGIN
            v_meta_attempt_id := (v_metadata->>'attempt_id')::UUID;
        EXCEPTION WHEN OTHERS THEN v_meta_attempt_id := NULL;
        END;
        v_meta_plan_code := v_metadata->>'plan_code';

        IF (v_meta_internal_sub_id IS NOT NULL AND v_meta_internal_sub_id <> v_locked_subscription_id) OR
           (v_meta_empresa_id IS NOT NULL AND v_meta_empresa_id <> v_locked_empresa_id) OR
           (v_meta_attempt_id IS NOT NULL AND v_meta_attempt_id <> v_locked_attempt_id) OR
           (v_meta_plan_code IS NOT NULL AND v_meta_plan_code <> p_canonical_plan_code) THEN
            UPDATE public.payment_events SET processing_status = 'rejected_permanent', sanitized_error_code = 'METADATA_MISMATCH' WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Metadata mismatch with locked session');
        END IF;

        IF v_locked_status IN ('open', 'expired') THEN
            UPDATE public.checkout_attempts SET status = 'expired', updated_at = now() WHERE id = v_locked_attempt_id;
        END IF;

        UPDATE public.payment_events SET 
            processing_status = 'processed', processed_at = now(), 
            subscription_id = v_locked_subscription_id, empresa_id = v_locked_empresa_id, updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'processed', 'event_id', v_event_id);
    END IF;
    
    -- 6. Resolve Context (Outros eventos)
    BEGIN
        -- Priorizar metadados diretos
        v_internal_sub_id := (v_metadata->>'subscription_id')::UUID;
        IF v_internal_sub_id IS NULL THEN
            v_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
        END IF;
        v_empresa_id := (v_metadata->>'empresa_id')::UUID;
        v_obs_plan_code := v_metadata->>'plan_code';
        v_checkout_attempt_id := (v_metadata->>'attempt_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        UPDATE public.payment_events SET processing_status = 'rejected_permanent', sanitized_error_code = 'MALFORMED_METADATA' WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Malformed metadata');
    END;

    -- Fallback para empresa_id se estiver vazio mas subscription_id existir
    IF v_empresa_id IS NULL AND v_internal_sub_id IS NOT NULL THEN
        SELECT empresa_id INTO v_empresa_id FROM public.subscriptions WHERE id = v_internal_sub_id;
    END IF;

    IF v_internal_sub_id IS NULL AND v_stripe_sub_id IS NOT NULL THEN
        SELECT id, empresa_id INTO v_internal_sub_id, v_empresa_id 
        FROM public.subscriptions WHERE stripe_subscription_id = v_stripe_sub_id;
    END IF;

    IF v_internal_sub_id IS NULL THEN
        UPDATE public.payment_events 
        SET processing_status = 'failed_retryable', sanitized_error_code = 'UNLINKED' 
        WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'failed_retryable', 'event_id', v_event_id);
    END IF;

    -- 7. Ordering Logic (Row Lock)
    SELECT stripe_last_event_created, stripe_last_event_priority, current_period_ends_at, status
    INTO v_last_event_created, v_last_event_priority, v_existing_current_period_end, v_existing_status
    FROM public.subscriptions WHERE id = v_internal_sub_id
    FOR UPDATE;

    IF v_last_event_created IS NOT NULL THEN
        IF p_event_created < v_last_event_created THEN
            v_is_out_of_order := TRUE;
        ELSIF p_event_created = v_last_event_created AND v_event_priority < v_last_event_priority THEN
            v_is_out_of_order := TRUE;
        END IF;
    END IF;

    IF v_is_out_of_order THEN
        UPDATE public.payment_events SET processing_status = 'ignored_out_of_order' WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'ignored_out_of_order', 'event_id', v_event_id);
    END IF;

    -- 8. EXTRAÇÃO FINANCEIRA POR TIPO DE EVENTO (Validar contrato Live)
    IF p_event_type IN ('customer.subscription.created', 'customer.subscription.updated') THEN
        v_obs_price_id := v_object->'items'->'data'->0->'price'->>'id';
        v_obs_currency := v_object->'items'->'data'->0->'price'->>'currency';
        -- v_obs_amount := (v_object->'items'->'data'->0->'price'->>'unit_amount')::BIGINT;
    ELSIF p_event_type = 'invoice.paid' THEN
        v_obs_currency := v_object->>'currency';
        -- v_obs_amount := (v_object->>'amount_paid')::BIGINT;
    END IF;

    -- 9. Atomic Application
    CASE p_event_type
        WHEN 'checkout.session.completed' THEN
            UPDATE public.subscriptions SET 
                stripe_customer_id = v_object->>'customer',
                stripe_subscription_id = v_object->>'subscription',
                stripe_checkout_session_id = v_object->>'id',
                updated_at = now()
            WHERE id = v_internal_sub_id;

            IF v_checkout_attempt_id IS NOT NULL THEN
                UPDATE public.checkout_attempts 
                SET status = 'completed', updated_at = now() 
                WHERE id = v_checkout_attempt_id AND empresa_id = v_empresa_id;
            END IF;

        WHEN 'customer.subscription.created', 'customer.subscription.updated' THEN
            v_current_period_end := (v_object->>'current_period_end')::BIGINT;
            UPDATE public.subscriptions SET 
                status = CASE 
                    WHEN v_object->>'status' = 'active' THEN 'active'
                    WHEN v_object->>'status' = 'past_due' THEN 'past_due'
                    WHEN v_object->>'status' = 'unpaid' THEN 'past_due'
                    WHEN v_object->>'status' = 'canceled' THEN 'canceled'
                    WHEN v_object->>'status' = 'trialing' THEN 'trialing'
                    ELSE status
                END,
                current_period_ends_at = GREATEST(v_existing_current_period_end, to_timestamp(v_current_period_end)),
                cancel_at_period_end = (v_object->>'cancel_at_period_end')::BOOLEAN,
                updated_at = now(),
                plan_id = COALESCE((SELECT id FROM public.plans WHERE code = 'enterprise_monthly' LIMIT 1), plan_id)
            WHERE id = v_internal_sub_id;

        WHEN 'invoice.paid' THEN
            UPDATE public.subscriptions SET 
                status = 'active', 
                last_payment_status = 'paid', 
                updated_at = now(),
                plan_id = COALESCE((SELECT id FROM public.plans WHERE code = 'enterprise_monthly' LIMIT 1), plan_id)
            WHERE id = v_internal_sub_id;

        WHEN 'customer.subscription.deleted' THEN
            UPDATE public.subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now() WHERE id = v_internal_sub_id;
        ELSE
    END CASE;

    -- 10. Finalize
    UPDATE public.subscriptions SET 
        stripe_last_event_created = p_event_created, stripe_last_event_priority = v_event_priority,
        stripe_last_event_id = p_provider_event_id, stripe_last_event_type = p_event_type
    WHERE id = v_internal_sub_id;

    UPDATE public.payment_events SET 
        processing_status = 'processed', processed_at = now(), 
        subscription_id = v_internal_sub_id, empresa_id = v_empresa_id, updated_at = now()
    WHERE id = v_event_id;

    RETURN jsonb_build_object('status', 'processed', 'event_id', v_event_id);
END;
$$;

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | final function name: public.log_stripe_webhook_diagnostic
CREATE OR REPLACE FUNCTION public.log_stripe_webhook_diagnostic(
    p_trace_id uuid,
    p_event_id_hash text,
    p_event_type text,
    p_stage text,
    p_reason_code text DEFAULT NULL,
    p_http_status integer DEFAULT 200
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_total_rows integer;
    v_rows_per_trace integer;
BEGIN
    -- 1. Limpeza oportunística de expirados
    DELETE FROM public.stripe_webhook_runtime_diagnostics
    WHERE expires_at <= now();

    -- 2. Limite de Volume Total (Global)
    SELECT count(*) INTO v_total_rows FROM public.stripe_webhook_runtime_diagnostics;
    IF v_total_rows >= 100 THEN
        RETURN;
    END IF;

    -- 3. Limite de Volume por Trace
    SELECT count(*) INTO v_rows_per_trace 
    FROM public.stripe_webhook_runtime_diagnostics 
    WHERE trace_id = p_trace_id;
    
    IF v_rows_per_trace >= 5 THEN
        RETURN;
    END IF;

    -- 4. Inserção Canônica
    INSERT INTO public.stripe_webhook_runtime_diagnostics (
        trace_id,
        event_id_hash,
        event_type,
        stage,
        reason_code,
        http_status
    ) VALUES (
        p_trace_id,
        p_event_id_hash,
        p_event_type,
        p_stage,
        p_reason_code,
        p_http_status
    )
    ON CONFLICT (trace_id, stage) DO NOTHING;
END;
$$;

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | final function name: public.purge_expired_stripe_webhook_runtime_diagnostics
CREATE OR REPLACE FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    DELETE FROM public.stripe_webhook_runtime_diagnostics
    WHERE expires_at <= now();
$$;

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | final function name: public.purge_all_stripe_webhook_runtime_diagnostics
CREATE OR REPLACE FUNCTION public.purge_all_stripe_webhook_runtime_diagnostics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    DELETE FROM public.stripe_webhook_runtime_diagnostics;
$$;

-- source: 20260811130048_4d9ed86f-021e-4394-adf9-14eafd875ca1.sql | final function name: public.process_stripe_checkout_session_expired
CREATE OR REPLACE FUNCTION public.process_stripe_checkout_session_expired(
  p_provider_event_id text,
  p_provider_session_id text,
  p_event_created bigint,
  p_payload_sha256 text,
  p_livemode boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_attempt_id uuid;
  v_empresa_id uuid;
  v_subscription_id uuid;
  v_status text;
  v_event_exists boolean;
BEGIN
  -- A. Rejeitar p_livemode=true
  IF p_livemode THEN
    RETURN 'livemode_rejected';
  END IF;

  -- B. Validar inputs
  IF p_provider_event_id IS NULL OR p_provider_event_id = '' THEN
    RETURN 'invalid_event_id';
  END IF;

  IF p_provider_session_id IS NULL OR NOT (p_provider_session_id LIKE 'cs_test_%') THEN
    RETURN 'invalid_session_id';
  END IF;

  IF p_event_created IS NULL OR p_event_created <= 0 THEN
    RETURN 'invalid_event_created';
  END IF;

  IF p_payload_sha256 IS NULL OR NOT (p_payload_sha256 ~ '^[0-9a-f]{64}$') THEN
    RETURN 'invalid_payload_hash';
  END IF;

  -- C. Localizar e Bloquear a Attempt (Autoridade da Linha)
  SELECT id, empresa_id, subscription_id, status
  INTO v_attempt_id, v_empresa_id, v_subscription_id, v_status
  FROM public.checkout_attempts
  WHERE provider = 'stripe'
    AND provider_checkout_session_id = p_provider_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'failed_retryable'; -- Attempt não localizada
  END IF;

  -- D. Validar integridade do evento se ele já existir
  SELECT EXISTS (
    SELECT 1 FROM public.payment_events
    WHERE provider = 'stripe'
      AND provider_event_id = p_provider_event_id
  ) INTO v_event_exists;

  -- E. Transição de Estado Idempotente (convergência)
  -- Se a tentativa está em estado inicial, convergir para expired INDEPENDENTE do evento ser novo ou duplicado
  IF v_status IN ('creating', 'open') THEN
    UPDATE public.checkout_attempts
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_attempt_id;
    v_status := 'expired';
  END IF;

  -- F. Tratamento de Retorno Baseado em Idempotência
  IF v_event_exists THEN
    RETURN 'duplicate';
  END IF;

  -- G. Se a tentativa já era terminal (paid/completed), ignoramos mutações
  IF v_status IN ('completed', 'paid', 'processed') THEN
    RETURN 'ignored_terminal';
  END IF;

  -- H. Se chegamos aqui, o evento é novo
  -- Registrar o Evento
  INSERT INTO public.payment_events (
    provider,
    provider_event_id,
    event_type,
    empresa_id,
    subscription_id,
    payload_sha256,
    processed_at
  ) VALUES (
    'stripe',
    p_provider_event_id,
    'checkout.session.expired',
    v_empresa_id,
    v_subscription_id,
    p_payload_sha256,
    now()
  );

  RETURN 'processed';

EXCEPTION WHEN OTHERS THEN
  RETURN 'internal_error';
END;
$function$;

-- source: 20260811165011_e6990962-2a65-4c59-8ac1-fe4041bd0147.sql | final function name: public.fn_handle_cartao_lancamento_empresa_id
CREATE OR REPLACE FUNCTION public.fn_handle_cartao_lancamento_empresa_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_empresa_id UUID;
BEGIN
    -- Buscar empresa_id do cartão
    SELECT empresa_id INTO v_empresa_id
    FROM public.cartoes_credito
    WHERE id = NEW.cartao_id;

    -- Validar existência do cartão
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Cartão não encontrado ou inválido' USING ERRCODE = '42P01';
    END IF;

    -- Preenchimento atômico ou validação
    IF NEW.empresa_id IS NULL THEN
        NEW.empresa_id := v_empresa_id;
    ELSIF NEW.empresa_id <> v_empresa_id THEN
        RAISE EXCEPTION 'Divergência de tenant: empresa_id informado não coincide com o cartão' USING ERRCODE = 'P0001';
    END IF;

    -- Bloqueio de troca de cartão para outra empresa em UPDATE
    IF TG_OP = 'UPDATE' THEN
        IF NEW.cartao_id <> OLD.cartao_id THEN
            IF (SELECT empresa_id FROM public.cartoes_credito WHERE id = NEW.cartao_id) <> OLD.empresa_id THEN
                RAISE EXCEPTION 'Não é permitido mover lançamentos entre cartões de empresas diferentes' USING ERRCODE = 'P0001';
            END IF;
        END IF;
        
        -- Impedir alteração manual de empresa_id
        IF NEW.empresa_id <> OLD.empresa_id THEN
             RAISE EXCEPTION 'Alteração manual de empresa_id não permitida' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- source: 20260811165011_e6990962-2a65-4c59-8ac1-fe4041bd0147.sql | final function name: public.fn_handle_cartao_fatura_empresa_id
CREATE OR REPLACE FUNCTION public.fn_handle_cartao_fatura_empresa_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_empresa_id UUID;
BEGIN
    SELECT empresa_id INTO v_empresa_id
    FROM public.cartoes_credito
    WHERE id = NEW.cartao_id;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Cartão não encontrado ou inválido' USING ERRCODE = '42P01';
    END IF;

    IF NEW.empresa_id IS NULL THEN
        NEW.empresa_id := v_empresa_id;
    ELSIF NEW.empresa_id <> v_empresa_id THEN
        RAISE EXCEPTION 'Divergência de tenant na fatura' USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

-- source: 20260813002500_recovery_checkout_attempt.sql | final function name: public.recovery_checkout_attempt
CREATE OR REPLACE FUNCTION public.recovery_checkout_attempt(
    p_attempt_id UUID,
    p_empresa_id UUID,
    p_verified_user_id UUID
)
RETURNS public.checkout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_attempt public.checkout_attempts;
BEGIN
    -- 1. Validação de Acesso (Ownership & Admin)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE empresa_id = p_empresa_id AND user_id = p_verified_user_id 
          AND status = 'active' AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Forbidden: Admin membership required';
    END IF;

    -- 2. Localizar e Lockar tentativa específica
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE id = p_attempt_id 
      AND empresa_id = p_empresa_id
      AND status = 'creating'
    FOR UPDATE;

    IF v_attempt.id IS NULL THEN
        RAISE EXCEPTION 'Attempt not found or not in creating status';
    END IF;

    -- 3. Transição Atômica para 'failed' (com reason_code de recuperação)
    -- Isso libera o slot único (idx_checkout_attempts_active_per_sub)
    UPDATE public.checkout_attempts
    SET 
        status = 'failed',
        reason_code = 'RECOVERY_TRIGGERED',
        updated_at = now()
    WHERE id = p_attempt_id
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

-- source: 20260813004921_b9259ceb-a315-4620-b3ca-edc3c10ef632.sql | final function name: public.fail_checkout_attempt_initialization
CREATE OR REPLACE FUNCTION public.fail_checkout_attempt_initialization(
    p_attempt_id UUID,
    p_empresa_id UUID,
    p_subscription_id UUID,
    p_livemode BOOLEAN,
    p_expected_updated_at TIMESTAMPTZ,
    p_reason_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_attempt public.checkout_attempts;
    v_reason_allowlist TEXT[] := ARRAY[
        'STRIPE_CLIENT_KEY_MISSING',
        'STRIPE_CLIENT_KEY_FORMAT_INVALID',
        'STRIPE_CLIENT_KEY_MODE_MISMATCH',
        'STRIPE_CLIENT_CONSTRUCTION_FAILED',
        'STRIPE_REQUEST_PREPARATION_FAILED'
    ];
BEGIN
    -- 1. Reason Code Validation
    IF NOT (p_reason_code = ANY(v_reason_allowlist)) THEN
        RAISE EXCEPTION 'Forbidden: Invalid reason_code for local failure compensation';
    END IF;

    -- 3. Atomic Lock and Compare-and-Set
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE id = p_attempt_id
      AND empresa_id = p_empresa_id
      AND subscription_id = p_subscription_id
      AND livemode = p_livemode
    FOR UPDATE;

    IF v_attempt.id IS NULL THEN
        RETURN 'not_found';
    END IF;

    -- Eligibility check
    IF v_attempt.status <> 'creating' THEN
        RETURN 'already_terminal';
    END IF;

    IF v_attempt.provider_checkout_session_id IS NOT NULL THEN
        RETURN 'not_eligible'; -- Already reached Stripe (or claimed to)
    END IF;

    -- Concurrency check
    IF v_attempt.updated_at <> p_expected_updated_at THEN
        RETURN 'conflict';
    END IF;

    -- 4. Finalize Failure
    UPDATE public.checkout_attempts
    SET 
        status = 'failed',
        last_error_code = p_reason_code,
        updated_at = now()
    WHERE id = p_attempt_id;

    RETURN 'failed';
END;
$$;

-- source: 20260813173838_4ee7a7ca-e540-4b92-a5d2-346ae1bec401.sql | final function name: public.check_rate_limit_persistent
CREATE OR REPLACE FUNCTION public.check_rate_limit_persistent(
    _key TEXT,
    _limit INTEGER,
    _window_interval INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    current_hits INTEGER;
BEGIN
    -- Limpeza de expirados (lazy cleanup)
    DELETE FROM public.rate_limits WHERE expires_at < now();

    INSERT INTO public.rate_limits (key, hits, expires_at)
    VALUES (_key, 1, now() + _window_interval)
    ON CONFLICT (key) DO UPDATE
    SET hits = rate_limits.hits + 1,
        last_hit = now()
    RETURNING hits INTO current_hits;

    RETURN current_hits <= _limit;
END;
$$;

-- source: 20260813210000_harden_sales_rpc_v2.sql | final function name: public.rpc_registrar_venda
CREATE OR REPLACE FUNCTION public.rpc_registrar_venda(
  p_empresa_id uuid,
  p_payload jsonb,
  p_items public.rpc_sale_item_input[],
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_item public.rpc_sale_item_input;
  v_existing_id uuid;
  v_total_items int;
BEGIN
  -- 1. Validar Autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validar Chave de Idempotência (Obrigatória, não vazia, formato razoável)
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida ou ausente' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Validar Vínculo com a Empresa e Permissão
  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = v_user_id
      AND empresa_id = p_empresa_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado à empresa' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Verificar Idempotência no Banco
  SELECT id INTO v_existing_id
  FROM public.sales
  WHERE empresa_id = p_empresa_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 5. Validar Venda sem Itens (Exceto se for fluxo de aporte, que deve ser tratado fora deste fluxo comercial de vendas)
  -- Mas conforme decisão: Fluxo comercial EXIGE itens.
  v_total_items := array_length(p_items, 1);
  IF p_items IS NULL OR v_total_items IS NULL OR v_total_items = 0 THEN
    RAISE EXCEPTION 'VENDA_SEM_ITENS' USING ERRCODE = 'P0001';
  END IF;

  -- 6. Validar Referências Cross-Tenant
  -- Cliente
  IF (p_payload->>'customer_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = (p_payload->>'customer_id')::uuid AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Cliente não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Conta Bancária
  IF (p_payload->>'bank_account_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = (p_payload->>'bank_account_id')::uuid AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 7. Inserir Venda (Atomicamente)
  BEGIN
    INSERT INTO public.sales (
      user_id,
      empresa_id,
      customer_id,
      customer_name,
      channel,
      status,
      payment_method,
      total,
      discount,
      mercado_pago_fees,
      frete_empresa,
      bank_account_id,
      sold_at,
      aporte_type,
      notes,
      idempotency_key
    )
    VALUES (
      v_user_id,
      p_empresa_id,
      (p_payload->>'customer_id')::uuid,
      p_payload->>'customer_name',
      p_payload->>'channel',
      p_payload->>'status',
      p_payload->>'payment_method',
      (p_payload->>'total')::numeric,
      (p_payload->>'discount')::numeric,
      COALESCE((p_payload->>'mercado_pago_fees')::numeric, 0),
      COALESCE((p_payload->>'frete_empresa')::numeric, 0),
      (p_payload->>'bank_account_id')::uuid,
      COALESCE((p_payload->>'sold_at')::timestamptz, now()),
      p_payload->>'aporte_type',
      p_payload->>'notes',
      p_idempotency_key
    )
    RETURNING id INTO v_sale_id;

    -- 8. Inserir Itens e Validar Cross-Tenant (Produtos)
    FOREACH v_item IN ARRAY p_items LOOP
      -- Validar produto
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_item.product_id AND empresa_id = p_empresa_id) THEN
        RAISE EXCEPTION 'Produto não pertence à empresa' USING ERRCODE = 'P0001';
      END IF;

      -- Validar quantidades
      IF v_item.quantity <= 0 THEN
        RAISE EXCEPTION 'Quantidade inválida para item' USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO public.sale_items (
        sale_id,
        user_id,
        empresa_id,
        product_id,
        quantity,
        unit_price,
        unit_cost
      )
      VALUES (
        v_sale_id,
        v_user_id,
        p_empresa_id,
        v_item.product_id,
        v_item.quantity,
        v_item.unit_price,
        v_item.unit_cost
      );
    END LOOP;

  EXCEPTION WHEN unique_violation THEN
    -- Fallback final para concorrência
    SELECT id INTO v_existing_id
    FROM public.sales
    WHERE empresa_id = p_empresa_id
      AND idempotency_key = p_idempotency_key;
      
    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
    RAISE;
  END;

  RETURN v_sale_id;
END;
$$;

-- source: 20260814123214_bf9ba6fd-4e74-4038-83e3-bade2b0d3dbe.sql | final function name: public.check_current_user_is_active_member
CREATE OR REPLACE FUNCTION public.check_current_user_is_active_member(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_company_access 
    WHERE user_id = auth.uid() 
      AND empresa_id = _empresa_id
      AND status = 'active'
  ) AND auth.uid() IS NOT NULL;
$$;

-- source: 20260814123214_bf9ba6fd-4e74-4038-83e3-bade2b0d3dbe.sql | final function name: public.check_current_user_is_admin
CREATE OR REPLACE FUNCTION public.check_current_user_is_admin(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_company_access 
    WHERE user_id = auth.uid() 
      AND empresa_id = _empresa_id
      AND status = 'active'
      AND role = 'admin'
  ) AND auth.uid() IS NOT NULL;
$$;

-- source: 20260816133125_22b6bda5-9bd2-4774-9630-38a7a0d8728b.sql | final function name: public.rpc_registrar_compra
CREATE OR REPLACE FUNCTION public.rpc_registrar_compra(
  p_empresa_id UUID,
  p_payload JSONB,
  p_items public.rpc_purchase_item_input[],
  p_payables public.rpc_purchase_payable_input[],
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_compra_id UUID;
  v_item public.rpc_purchase_item_input;
  v_payable public.rpc_purchase_payable_input;
  v_existing_id UUID;
  v_total_items INT;
BEGIN
  -- 1. Validar Autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validar Chave de Idempotência
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida ou ausente' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Validar Vínculo com a Empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = v_user_id
      AND empresa_id = p_empresa_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado à empresa' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Verificar Idempotência
  SELECT id INTO v_existing_id
  FROM public.compras
  WHERE empresa_id = p_empresa_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 5. Validar Itens
  v_total_items := array_length(p_items, 1);
  IF p_items IS NULL OR v_total_items IS NULL OR v_total_items = 0 THEN
    RAISE EXCEPTION 'Compra sem itens' USING ERRCODE = 'P0001';
  END IF;

  -- 6. Validar Referências Cross-Tenant (Fornecedor, Conta)
  IF (p_payload->>'fornecedor_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = (p_payload->>'fornecedor_id')::UUID AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Fornecedor não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF (p_payload->>'bank_account_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = (p_payload->>'bank_account_id')::UUID AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 7. Inserir Compra
  INSERT INTO public.compras (
    user_id, empresa_id, fornecedor_id, data_compra, numero_nf, condicao_pagamento, 
    forma_pagamento, bank_account_id, parcelas, dia_vencimento, data_vencimento, 
    subtotal, desconto, frete, total, observacoes, status, idempotency_key
  )
  VALUES (
    v_user_id, p_empresa_id, (p_payload->>'fornecedor_id')::UUID, (p_payload->>'data_compra')::DATE, 
    p_payload->>'numero_nf', p_payload->>'condicao_pagamento', p_payload->>'forma_pagamento',
    (p_payload->>'bank_account_id')::UUID, (p_payload->>'parcelas')::INT, 
    (p_payload->>'dia_vencimento')::INT, (p_payload->>'data_vencimento')::DATE,
    (p_payload->>'subtotal')::NUMERIC, (p_payload->>'desconto')::NUMERIC,
    (p_payload->>'frete')::NUMERIC, (p_payload->>'total')::NUMERIC,
    p_payload->>'observacoes', COALESCE(p_payload->>'status', 'confirmada'), p_idempotency_key
  )
  RETURNING id INTO v_compra_id;

  -- 8. Inserir Itens e Atualizar Estoque/Custo
  FOREACH v_item IN ARRAY p_items LOOP
    -- Validar Produto Cross-Tenant
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_item.produto_id AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Produto não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;

    IF v_item.quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE = 'P0001';
    END IF;

    -- Inserir Item
    INSERT INTO public.compras_itens (compra_id, user_id, empresa_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_compra_id, v_user_id, p_empresa_id, v_item.produto_id, v_item.quantidade, v_item.preco_unitario, (v_item.quantidade * v_item.preco_unitario));

    -- Atualizar Estoque e Custo
    UPDATE public.products 
    SET stock = stock + v_item.quantidade,
        cost_price = v_item.preco_unitario,
        updated_at = now()
    WHERE id = v_item.produto_id;
  END LOOP;

  -- 9. Inserir Payables
  IF p_payables IS NOT NULL THEN
    FOREACH v_payable IN ARRAY p_payables LOOP
        -- Validar Conta Bancária se houver
        IF v_payable.bank_account_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = v_payable.bank_account_id AND empresa_id = p_empresa_id) THEN
                RAISE EXCEPTION 'Conta bancária da parcela não pertence à empresa' USING ERRCODE = 'P0001';
            END IF;
        END IF;

        INSERT INTO public.payables (
            user_id, empresa_id, supplier_id, description, category, amount, 
            due_date, status, paid_amount, paid_at, bank_account_id, recurrence
        )
        VALUES (
            v_user_id, p_empresa_id, (p_payload->>'fornecedor_id')::UUID, v_payable.description, 
            'Fornecedor', v_payable.amount, v_payable.due_date, v_payable.status, 
            v_payable.paid_amount, v_payable.paid_at, v_payable.bank_account_id, 'nenhuma'
        );
    END LOOP;
  END IF;

  RETURN v_compra_id;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_existing_id FROM public.compras WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  RAISE;
END;
$function$;

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final trigger: products.products_updated_at
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final trigger: customers.customers_updated_at
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final trigger: suppliers.suppliers_updated_at
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final trigger: payables.payables_updated_at
CREATE TRIGGER payables_updated_at BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260616214246_53c304ae-016a-44fe-86ce-7d7427d857d9.sql | final trigger: receivables.receivables_updated_at
CREATE TRIGGER receivables_updated_at BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260616215411_25ada916-2e42-410c-a1a9-a47819029dce.sql | final trigger: company_settings.company_settings_updated_at
CREATE TRIGGER company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260617002237_80220513-bc4e-43be-b99e-a474b31267e4.sql | final trigger: controle_vendas_diario.set_updated_at_cvd
CREATE TRIGGER set_updated_at_cvd BEFORE UPDATE ON public.controle_vendas_diario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260617002237_80220513-bc4e-43be-b99e-a474b31267e4.sql | final trigger: controle_vendas_fornecedor.set_updated_at_cvf
CREATE TRIGGER set_updated_at_cvf BEFORE UPDATE ON public.controle_vendas_fornecedor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | final trigger: bank_accounts.bank_accounts_updated_at
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | final trigger: bank_movements.bank_movements_updated_at
CREATE TRIGGER bank_movements_updated_at BEFORE UPDATE ON public.bank_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260617014243_516061f3-55a6-45c7-8403-d7b9f1e0f41f.sql | final trigger: payment_routing_rules.set_payment_routing_rules_updated_at
CREATE TRIGGER set_payment_routing_rules_updated_at
  BEFORE UPDATE ON public.payment_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | final trigger: cartoes_credito.set_cartoes_credito_updated
CREATE TRIGGER set_cartoes_credito_updated BEFORE UPDATE ON public.cartoes_credito FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | final trigger: cartoes_lancamentos.set_cartoes_lancamentos_updated
CREATE TRIGGER set_cartoes_lancamentos_updated BEFORE UPDATE ON public.cartoes_lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | final trigger: cartoes_faturas.set_cartoes_faturas_updated
CREATE TRIGGER set_cartoes_faturas_updated BEFORE UPDATE ON public.cartoes_faturas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260618005921_414315c7-4ece-4d34-bac6-e710a982434e.sql | final trigger: compras.compras_updated_at
CREATE TRIGGER compras_updated_at BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260619235639_ea8cd248-5c49-4ff7-b04a-5510f2b202dd.sql | final trigger: aportes_financeiros.set_aportes_financeiros_updated_at
CREATE TRIGGER set_aportes_financeiros_updated_at
BEFORE UPDATE ON public.aportes_financeiros
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | final trigger: cartoes_lancamentos.audit_cartoes_lancamentos
CREATE TRIGGER audit_cartoes_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.cartoes_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | final trigger: payables.audit_payables
CREATE TRIGGER audit_payables
  AFTER INSERT OR UPDATE OR DELETE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | final trigger: receivables.audit_receivables
CREATE TRIGGER audit_receivables
  AFTER INSERT OR UPDATE OR DELETE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | final trigger: bank_movements.audit_bank_movements
CREATE TRIGGER audit_bank_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_movements
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sales.trg_sales_status_to_finance
CREATE TRIGGER trg_sales_status_to_finance AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sale_status_to_finance();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sales.trg_sales_create_receivable
CREATE TRIGGER trg_sales_create_receivable AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.create_receivable_for_sale();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sales.trg_sales_create_finance
CREATE TRIGGER trg_sales_create_finance AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.create_finance_for_sale();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sales.trg_sales_sync_total
CREATE TRIGGER trg_sales_sync_total AFTER UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_total_to_finance();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sales.trg_sales_sync_cvd
CREATE TRIGGER trg_sales_sync_cvd AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_sale_sync_cvd();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sale_items.trg_sale_items_decrement_stock
CREATE TRIGGER trg_sale_items_decrement_stock AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale_item();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sale_items.trg_sale_items_restore_stock
CREATE TRIGGER trg_sale_items_restore_stock AFTER DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_sale_item_delete();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: sale_items.trg_sale_items_sync_cvd
CREATE TRIGGER trg_sale_items_sync_cvd AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_sale_items_sync_cvd();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: receivables.trg_receivables_to_finance
CREATE TRIGGER trg_receivables_to_finance AFTER UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.receivable_to_finance();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: receivables.trg_receivables_to_bank_movement
CREATE TRIGGER trg_receivables_to_bank_movement AFTER UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.receivable_to_bank_movement();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: payables.trg_payables_to_finance
CREATE TRIGGER trg_payables_to_finance AFTER UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.payable_to_finance();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: payables.trg_payables_to_bank_movement
CREATE TRIGGER trg_payables_to_bank_movement AFTER UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.payable_to_bank_movement();

-- source: 20260620170832_aaa6a6d2-fa1f-48c5-8f9f-39637cc18d3d.sql | final trigger: bank_accounts.trg_bank_accounts_initial_balance
CREATE TRIGGER trg_bank_accounts_initial_balance AFTER INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.bank_account_initial_balance_movement();

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final trigger: dre_regras.dre_regras_set_updated_at
CREATE TRIGGER dre_regras_set_updated_at BEFORE UPDATE ON public.dre_regras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final trigger: dre_regras.dre_regras_audit
CREATE TRIGGER dre_regras_audit AFTER INSERT OR UPDATE OR DELETE ON public.dre_regras
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final trigger: dre_classificacoes.dre_class_set_updated_at
CREATE TRIGGER dre_class_set_updated_at BEFORE UPDATE ON public.dre_classificacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final trigger: dre_classificacoes.dre_class_audit
CREATE TRIGGER dre_class_audit AFTER INSERT OR UPDATE OR DELETE ON public.dre_classificacoes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- source: 20260811165011_e6990962-2a65-4c59-8ac1-fe4041bd0147.sql | final trigger: cartoes_lancamentos.tr_cartao_lancamento_empresa_id_gate
CREATE TRIGGER tr_cartao_lancamento_empresa_id_gate
    BEFORE INSERT OR UPDATE ON public.cartoes_lancamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_handle_cartao_lancamento_empresa_id();

-- source: 20260811165011_e6990962-2a65-4c59-8ac1-fe4041bd0147.sql | final trigger: cartoes_faturas.tr_cartao_fatura_empresa_id_gate
CREATE TRIGGER tr_cartao_fatura_empresa_id_gate
    BEFORE INSERT OR UPDATE ON public.cartoes_faturas
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_handle_cartao_fatura_empresa_id();
