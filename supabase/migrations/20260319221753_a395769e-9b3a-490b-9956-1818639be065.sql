
ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS status_pagamento text DEFAULT 'em_aberto',
  ADD COLUMN IF NOT EXISTS data_vencimento date;

-- Set existing records with data_envio as 'pago'
UPDATE public.movimentacoes_financeiras
  SET status_pagamento = 'pago'
  WHERE data_envio IS NOT NULL;

-- Set existing records with origem 'telegram' as 'pago'
UPDATE public.movimentacoes_financeiras
  SET status_pagamento = 'pago'
  WHERE origem = 'telegram' AND status_pagamento = 'em_aberto';
