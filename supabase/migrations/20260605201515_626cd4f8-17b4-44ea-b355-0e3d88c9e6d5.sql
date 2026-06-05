
ALTER TABLE public.planejamento_mensal
  ADD COLUMN IF NOT EXISTS receita_cancelada numeric(12,2),
  ADD COLUMN IF NOT EXISTS taxa_conversao numeric(8,4);

CREATE OR REPLACE FUNCTION public.planejamento_mensal_calc()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  rc numeric := COALESCE(NEW.receita_captada, 0);
  ta numeric := COALESCE(NEW.taxa_aprovacao, 0);
  pc numeric := COALESCE(NEW.pedidos_captados, 0);
  tq numeric := COALESCE(NEW.taxa_aquisicao, 0);
  st numeric := COALESCE(NEW.sessoes_totais, 0);
  sm numeric := COALESCE(NEW.sessoes_midia, 0);
  it numeric := COALESCE(NEW.investimento_total, 0);
  rf numeric; pf numeric; pa numeric; ra numeric; pr numeric; rr numeric;
BEGIN
  rf := rc * ta / 100;
  pf := pc * ta / 100;
  pa := pf * tq / 100;
  ra := rf * tq / 100;
  pr := pf - pa;
  rr := rc - ra;
  NEW.receita_faturada := rf;
  NEW.receita_cancelada := rc - rf;
  NEW.pedidos_faturados := pf;
  NEW.pedidos_aquisicao := pa;
  NEW.receita_aquisicao := ra;
  NEW.pedidos_retencao := pr;
  NEW.receita_retencao := rr;
  NEW.taxa_retencao := CASE WHEN ta IS NULL THEN NULL ELSE 100 - tq END;
  NEW.taxa_conversao := CASE WHEN st > 0 THEN pc::numeric / st * 100 END;
  NEW.ticket_medio_aquisicao := CASE WHEN pa > 0 THEN ra / pa END;
  NEW.ticket_medio_retencao := CASE WHEN pr > 0 THEN rr / pr END;
  NEW.ticket_medio_geral := CASE WHEN pf > 0 THEN rf / pf END;
  NEW.cps_geral := CASE WHEN st > 0 THEN it / st END;
  NEW.cps_midia := CASE WHEN sm > 0 THEN it / sm END;
  NEW.cac_novos := CASE WHEN pa > 0 THEN it / pa END;
  NEW.cac_geral := CASE WHEN pf > 0 THEN it / pf END;
  NEW.roas_faturado := CASE WHEN it > 0 THEN rf / it END;
  NEW.adcost_pct := CASE WHEN rf > 0 THEN it / rf * 100 END;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;
