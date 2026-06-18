
CREATE OR REPLACE FUNCTION public.sync_sale_total_to_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.total IS DISTINCT FROM OLD.total THEN
    -- Update direct bank movement (cash/pix/debit sales already delivered)
    UPDATE public.bank_movements
       SET amount = NEW.total
     WHERE origin = 'sale' AND reference_id = NEW.id;

    -- Update pending receivable amount (card/prazo sales)
    UPDATE public.receivables
       SET amount = NEW.total
     WHERE sale_id = NEW.id
       AND COALESCE(received_amount, 0) = 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_sync_total ON public.sales;
CREATE TRIGGER sale_sync_total
AFTER UPDATE OF total ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_total_to_finance();

-- Backfill: re-sync existing sales where movement amount drifted from sale total
UPDATE public.bank_movements bm
   SET amount = s.total
  FROM public.sales s
 WHERE bm.origin = 'sale'
   AND bm.reference_id = s.id
   AND bm.amount <> s.total;

UPDATE public.receivables r
   SET amount = s.total
  FROM public.sales s
 WHERE r.sale_id = s.id
   AND COALESCE(r.received_amount, 0) = 0
   AND r.amount <> s.total;
