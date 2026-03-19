
-- Create trigger to auto-set telegram records as 'pago'
CREATE OR REPLACE FUNCTION public.auto_pago_telegram()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.origem = 'telegram' THEN
    NEW.status_pagamento := 'pago';
    IF NEW.data_envio IS NULL THEN
      NEW.data_envio := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_pago_telegram
  BEFORE INSERT OR UPDATE ON public.movimentacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_pago_telegram();

-- Fix any existing telegram records
UPDATE public.movimentacoes_financeiras
  SET status_pagamento = 'pago', data_envio = COALESCE(data_envio, CURRENT_DATE)
  WHERE origem = 'telegram' AND (status_pagamento IS NULL OR status_pagamento = 'em_aberto');
