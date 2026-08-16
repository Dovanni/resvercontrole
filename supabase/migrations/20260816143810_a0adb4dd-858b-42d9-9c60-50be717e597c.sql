BEGIN;

-- 1. Reversão de estoque para a Compra 1 (ID 997ca6c6...)
-- Produto: Condicionador Absolut Repair (a5925283...), Qtd: 5
UPDATE public.products 
SET stock = stock - 5, updated_at = now()
WHERE id = 'a5925283-38fb-45ca-bfb4-8f504ccd0e1a' AND empresa_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7';

-- 2. Reversão de estoque para a Compra 2 (ID 037f91d4...)
-- Produto: Leave in Rejuvenescedor (10391956...), Qtd: 1
UPDATE public.products 
SET stock = stock - 1, updated_at = now()
WHERE id = '10391956-f671-4b70-b6e6-9452d9682c2c' AND empresa_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7';

-- 3. Remoção de contas a pagar (payables)
-- Identificados via supplier_id (CPFL), valor e janela temporal de criação
DELETE FROM public.payables 
WHERE supplier_id = '7f03f57d-9f94-461b-bd0e-b819ee422b4e' 
  AND amount = 100 
  AND created_at >= '2026-08-16 13:40:00+00';

-- 4. Remoção de itens das compras
DELETE FROM public.compras_itens 
WHERE compra_id IN ('997ca6c6-1ae8-4429-a012-4aea1b45dbef', '037f91d4-4161-4345-a57a-e9384eedb1a9');

-- 5. Remoção dos registros principais de compras
DELETE FROM public.compras 
WHERE id IN ('997ca6c6-1ae8-4429-a012-4aea1b45dbef', '037f91d4-4161-4345-a57a-e9384eedb1a9');

COMMIT;

-- Auditoria Pós-Remoção
SELECT 
    (SELECT count(*) FROM public.compras WHERE id IN ('997ca6c6-1ae8-4429-a012-4aea1b45dbef', '037f91d4-4161-4345-a57a-e9384eedb1a9')) as compras_restantes,
    (SELECT count(*) FROM public.compras_itens WHERE compra_id IN ('997ca6c6-1ae8-4429-a012-4aea1b45dbef', '037f91d4-4161-4345-a57a-e9384eedb1a9')) as itens_restantes,
    (SELECT count(*) FROM public.payables WHERE supplier_id = '7f03f57d-9f94-461b-bd0e-b819ee422b4e' AND amount = 100 AND created_at >= '2026-08-16 13:40:00+00') as payables_restantes,
    (SELECT stock FROM public.products WHERE id = 'a5925283-38fb-45ca-bfb4-8f504ccd0e1a') as stock_prod1_final,
    (SELECT stock FROM public.products WHERE id = '10391956-f671-4b70-b6e6-9452d9682c2c') as stock_prod2_final,
    (SELECT count(*) FROM public.compras c JOIN public.suppliers s ON c.fornecedor_id = s.id WHERE s.name = 'CPFL' AND c.total = 100 AND c.data_compra = '2026-08-16') as total_cpfl_indevidos;