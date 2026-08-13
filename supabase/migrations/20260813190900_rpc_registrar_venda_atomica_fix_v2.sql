-- Wave D: Reconciliação Final de Propagação Multitenant

-- 1. Corrigir sync_cvd_from_sale para incluir empresa_id
CREATE OR REPLACE FUNCTION public.sync_cvd_from_sale(_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
