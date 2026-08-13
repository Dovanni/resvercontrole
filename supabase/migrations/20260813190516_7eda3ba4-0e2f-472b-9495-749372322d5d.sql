-- MIGRATION: 20260814000000_rpc_registrar_venda_atomica.sql
-- OBJETIVO: Criar RPC atômica para registro de venda e garantir propagação de empresa_id

-- 1. Atualizar decrement_stock_on_sale_item para garantir isolamento multiempresa e propagação
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- 2. Atualizar create_receivable_for_sale para propagar empresa_id
CREATE OR REPLACE FUNCTION public.create_receivable_for_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- 3. Atualizar sale_status_to_finance para propagar empresa_id
CREATE OR REPLACE FUNCTION public.sale_status_to_finance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- 4. Definir Tipos para a RPC
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rpc_sale_item_input') THEN
        CREATE TYPE public.rpc_sale_item_input AS (
            product_id uuid,
            quantity numeric,
            unit_price numeric,
            unit_cost numeric
        );
    END IF;
END $$;

-- 5. RPC Atômica para Registrar Venda
CREATE OR REPLACE FUNCTION public.rpc_registrar_venda(
  p_empresa_id uuid,
  p_payload jsonb,
  p_items public.rpc_sale_item_input[],
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_item public.rpc_sale_item_input;
BEGIN
  -- 1. Validar Autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validar Vínculo com a Empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = v_user_id AND empresa_id = p_empresa_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado à empresa' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Inserir Venda (Trigger dispara fluxos financeiros)
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
    notes
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
    p_payload->>'notes'
  )
  RETURNING id INTO v_sale_id;

  -- 5. Inserir Itens (Trigger dispara decremento de estoque)
  IF p_items IS NOT NULL AND array_length(p_items, 1) > 0 THEN
    FOREACH v_item IN ARRAY p_items LOOP
      -- Validar se produto pertence à empresa
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_item.product_id AND empresa_id = p_empresa_id) THEN
        RAISE EXCEPTION 'Produto % não pertence à empresa selecionada', v_item.product_id;
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
  END IF;

  RETURN v_sale_id;
END;
$$;

-- 6. Garantir permissões
GRANT EXECUTE ON FUNCTION public.rpc_registrar_venda TO authenticated;
GRANT ALL ON public.sale_items TO authenticated;
GRANT ALL ON public.sales TO authenticated;

-- 7. Documentar Auditoria
COMMENT ON FUNCTION public.rpc_registrar_venda IS 'Registra venda e itens de forma atômica com isolamento multiempresa (VMEAP F4).';
