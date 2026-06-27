
-- Receivables: keep trg_*, drop legacy duplicates
DROP TRIGGER IF EXISTS receivables_to_bank ON public.receivables;
DROP TRIGGER IF EXISTS receivables_to_finance ON public.receivables;

-- Sales: keep trg_*, drop legacy duplicates
DROP TRIGGER IF EXISTS sale_create_finance ON public.sales;
DROP TRIGGER IF EXISTS sale_create_receivable ON public.sales;
DROP TRIGGER IF EXISTS sale_status_finance ON public.sales;
DROP TRIGGER IF EXISTS sale_sync_cvd ON public.sales;
DROP TRIGGER IF EXISTS sale_sync_total ON public.sales;

-- Sale items: keep trg_*, drop legacy duplicates
DROP TRIGGER IF EXISTS sale_item_decrement_stock ON public.sale_items;
DROP TRIGGER IF EXISTS sale_item_restore_stock ON public.sale_items;
DROP TRIGGER IF EXISTS sale_items_sync_cvd ON public.sale_items;

-- Bank accounts: keep trg_bank_accounts_initial_balance, drop the other three
DROP TRIGGER IF EXISTS bank_account_initial_balance_movement_ins ON public.bank_accounts;
DROP TRIGGER IF EXISTS bank_account_initial_balance_movement_upd ON public.bank_accounts;
DROP TRIGGER IF EXISTS bank_accounts_initial_balance_movement ON public.bank_accounts;

-- Remove the duplicated finance entry (keep the original 2b32b9be)
DELETE FROM public.finance_entries
 WHERE id = '015cc5db-cb0d-4517-8760-0bd5093746c2';
