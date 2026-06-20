
ALTER TABLE public.controle_vendas_diario
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.controle_vendas_diario
  DROP CONSTRAINT IF EXISTS controle_vendas_diario_origem_check;
ALTER TABLE public.controle_vendas_diario
  ADD CONSTRAINT controle_vendas_diario_origem_check
  CHECK (origem IN ('manual','venda_automatica'));

CREATE UNIQUE INDEX IF NOT EXISTS cvd_sale_unique
  ON public.controle_vendas_diario(sale_id) WHERE sale_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_cvd_from_sale(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.sales%ROWTYPE;
  v_subtotal numeric(12,2);
  v_cost numeric(12,2);
  v_frete numeric(12,2);
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

  SELECT COALESCE(SUM(unit_price*quantity),0), COALESCE(SUM(unit_cost*quantity),0)
    INTO v_subtotal, v_cost
    FROM public.sale_items WHERE sale_id = _sale_id;

  v_loja := s.total;
  v_juros := COALESCE(s.mercado_pago_fees, 0);
  v_frete := GREATEST(s.total - (v_subtotal - COALESCE(s.discount,0)), 0);
  v_date := s.sold_at::date;
  v_lucro := v_loja - v_cost - v_juros;

  DELETE FROM public.controle_vendas_diario WHERE sale_id = _sale_id;

  INSERT INTO public.controle_vendas_diario
    (user_id, data, mes, ano, loja, custo, juros_ml, frete_empresa, frete_cliente,
     receber, rateio, lucro, origem, sale_id)
  VALUES
    (s.user_id, v_date, EXTRACT(MONTH FROM v_date)::int, EXTRACT(YEAR FROM v_date)::int,
     v_loja, v_cost, v_juros, 0, v_frete, v_loja, 0, v_lucro,
     'venda_automatica', _sale_id);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sale_sync_cvd()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.controle_vendas_diario WHERE sale_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.sync_cvd_from_sale(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sale_sync_cvd ON public.sales;
CREATE TRIGGER sale_sync_cvd
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.tg_sale_sync_cvd();

CREATE OR REPLACE FUNCTION public.tg_sale_items_sync_cvd()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_cvd_from_sale(OLD.sale_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_cvd_from_sale(NEW.sale_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sale_items_sync_cvd ON public.sale_items;
CREATE TRIGGER sale_items_sync_cvd
AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.tg_sale_items_sync_cvd();

-- Backfill
DO $$
DECLARE
  s record;
  existing_id uuid;
BEGIN
  FOR s IN
    SELECT * FROM public.sales
    WHERE status = 'entregue' AND channel <> 'recursos_financeiros'
  LOOP
    SELECT id INTO existing_id
      FROM public.controle_vendas_diario
      WHERE user_id = s.user_id
        AND data = s.sold_at::date
        AND loja = s.total
        AND sale_id IS NULL
      LIMIT 1;
    IF existing_id IS NOT NULL THEN
      UPDATE public.controle_vendas_diario
         SET sale_id = s.id, origem = 'venda_automatica'
       WHERE id = existing_id;
    ELSE
      PERFORM public.sync_cvd_from_sale(s.id);
    END IF;
  END LOOP;
END $$;
