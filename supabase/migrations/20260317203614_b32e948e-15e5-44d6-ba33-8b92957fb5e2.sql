ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS custo_marketing numeric DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS custo_frete numeric DEFAULT 0;