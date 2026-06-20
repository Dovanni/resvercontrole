ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_customer_type_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_customer_type_check CHECK (customer_type IN ('atacado','varejo','recursos_financeiros'));

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_channel_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_channel_check CHECK (channel IN ('atacado','varejo','recursos_financeiros'));