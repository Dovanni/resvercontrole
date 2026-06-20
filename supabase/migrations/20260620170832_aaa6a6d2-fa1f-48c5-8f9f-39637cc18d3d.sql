
CREATE OR REPLACE FUNCTION public.sync_sale_total_to_finance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

DROP TRIGGER IF EXISTS trg_sales_status_to_finance ON public.sales;
CREATE TRIGGER trg_sales_status_to_finance AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sale_status_to_finance();

DROP TRIGGER IF EXISTS trg_sales_create_receivable ON public.sales;
CREATE TRIGGER trg_sales_create_receivable AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.create_receivable_for_sale();

DROP TRIGGER IF EXISTS trg_sales_create_finance ON public.sales;
CREATE TRIGGER trg_sales_create_finance AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.create_finance_for_sale();

DROP TRIGGER IF EXISTS trg_sales_sync_total ON public.sales;
CREATE TRIGGER trg_sales_sync_total AFTER UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_total_to_finance();

DROP TRIGGER IF EXISTS trg_sales_sync_cvd ON public.sales;
CREATE TRIGGER trg_sales_sync_cvd AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_sale_sync_cvd();

DROP TRIGGER IF EXISTS trg_sale_items_decrement_stock ON public.sale_items;
CREATE TRIGGER trg_sale_items_decrement_stock AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale_item();

DROP TRIGGER IF EXISTS trg_sale_items_restore_stock ON public.sale_items;
CREATE TRIGGER trg_sale_items_restore_stock AFTER DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_sale_item_delete();

DROP TRIGGER IF EXISTS trg_sale_items_sync_cvd ON public.sale_items;
CREATE TRIGGER trg_sale_items_sync_cvd AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_sale_items_sync_cvd();

DROP TRIGGER IF EXISTS trg_receivables_to_finance ON public.receivables;
CREATE TRIGGER trg_receivables_to_finance AFTER UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.receivable_to_finance();

DROP TRIGGER IF EXISTS trg_receivables_to_bank_movement ON public.receivables;
CREATE TRIGGER trg_receivables_to_bank_movement AFTER UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.receivable_to_bank_movement();

DROP TRIGGER IF EXISTS trg_payables_to_finance ON public.payables;
CREATE TRIGGER trg_payables_to_finance AFTER UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.payable_to_finance();

DROP TRIGGER IF EXISTS trg_payables_to_bank_movement ON public.payables;
CREATE TRIGGER trg_payables_to_bank_movement AFTER UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.payable_to_bank_movement();

DROP TRIGGER IF EXISTS trg_bank_accounts_initial_balance ON public.bank_accounts;
CREATE TRIGGER trg_bank_accounts_initial_balance AFTER INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.bank_account_initial_balance_movement();

UPDATE public.sales SET total = 63.12
 WHERE id = '2b261402-c5c9-405b-8455-d0403579253f';

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.sales WHERE sold_at >= '2026-06-01' AND sold_at < '2026-07-01' LOOP
    PERFORM public.sync_cvd_from_sale(r.id);
  END LOOP;
END $$;
