ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS overhead_percentual numeric DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS devolucao_percentual numeric DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cac_percentual numeric DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS chargeback_percentual numeric DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS conteudo_percentual numeric DEFAULT 0;