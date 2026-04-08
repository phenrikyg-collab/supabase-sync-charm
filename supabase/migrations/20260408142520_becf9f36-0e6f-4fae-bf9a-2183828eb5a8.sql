
-- Update status_pagamento for credit card transactions based on payment existence
-- Rule: If a pagamento_fatura exists for the same fatura_id → 'pago'
-- Rule: If no payment AND data_vencimento > today → 'aguardando_fatura'
-- Rule: If no payment AND data_vencimento <= today → 'fatura_vencida'

-- Step 1: Mark all card transactions as 'pago' where a pagamento_fatura exists for their fatura
UPDATE movimentacoes_financeiras mf
SET status_pagamento = 'pago'
WHERE mf.conta_tipo = 'cartao_fatura'
  AND mf.fatura_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM movimentacoes_financeiras pf
    WHERE pf.fatura_id = mf.fatura_id
      AND pf.origem = 'pagamento_fatura'
  );

-- Step 2: Mark card transactions as 'aguardando_fatura' where no payment and vencimento is in the future
UPDATE movimentacoes_financeiras mf
SET status_pagamento = 'aguardando_fatura'
WHERE mf.conta_tipo = 'cartao_fatura'
  AND mf.fatura_id IS NOT NULL
  AND mf.data_vencimento > CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_financeiras pf
    WHERE pf.fatura_id = mf.fatura_id
      AND pf.origem = 'pagamento_fatura'
  );

-- Step 3: Mark card transactions as 'fatura_vencida' where no payment and vencimento has passed
UPDATE movimentacoes_financeiras mf
SET status_pagamento = 'fatura_vencida'
WHERE mf.conta_tipo = 'cartao_fatura'
  AND mf.fatura_id IS NOT NULL
  AND (mf.data_vencimento IS NULL OR mf.data_vencimento <= CURRENT_DATE)
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_financeiras pf
    WHERE pf.fatura_id = mf.fatura_id
      AND pf.origem = 'pagamento_fatura'
  );
