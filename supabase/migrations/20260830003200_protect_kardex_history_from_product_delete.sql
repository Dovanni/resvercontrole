ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT stock_movements_product_id_fkey ON public.stock_movements IS
  'Preserva a trilha do Kardex: produtos com movimentações históricas não podem ser excluídos fisicamente.';