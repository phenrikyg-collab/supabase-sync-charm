
-- 1. Add columns for planejado premissas
ALTER TABLE public.planejamento_mensal
  ADD COLUMN IF NOT EXISTS sessoes_organicas numeric,
  ADD COLUMN IF NOT EXISTS premissa_taxa_conversao numeric,
  ADD COLUMN IF NOT EXISTS premissa_ticket_medio numeric,
  ADD COLUMN IF NOT EXISTS premissa_taxa_aprovacao numeric,
  ADD COLUMN IF NOT EXISTS premissa_taxa_aquisicao numeric,
  ADD COLUMN IF NOT EXISTS premissa_cps_midia numeric;

-- 2. Update trigger to derive from premissas when tipo='planejado'
CREATE OR REPLACE FUNCTION public.planejamento_mensal_calc()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  rc numeric; ta numeric; pc numeric; tq numeric;
  st numeric; sm numeric; it numeric; so numeric;
  rf numeric; pf numeric; pa numeric; ra numeric; pr numeric; rr numeric;
BEGIN
  IF NEW.tipo = 'planejado' THEN
    st := COALESCE(NEW.sessoes_totais, 0);
    so := COALESCE(NEW.sessoes_organicas, 0);
    sm := GREATEST(st - so, 0);
    NEW.sessoes_midia := sm;
    it := sm * COALESCE(NEW.premissa_cps_midia, 0);
    NEW.investimento_total := it;
    pc := st * COALESCE(NEW.premissa_taxa_conversao, 0) / 100;
    NEW.pedidos_captados := pc;
    rc := pc * COALESCE(NEW.premissa_ticket_medio, 0);
    NEW.receita_captada := rc;
    ta := COALESCE(NEW.premissa_taxa_aprovacao, 0);
    NEW.taxa_aprovacao := ta;
    tq := COALESCE(NEW.premissa_taxa_aquisicao, 0);
    NEW.taxa_aquisicao := tq;
  ELSE
    rc := COALESCE(NEW.receita_captada, 0);
    ta := COALESCE(NEW.taxa_aprovacao, 0);
    pc := COALESCE(NEW.pedidos_captados, 0);
    tq := COALESCE(NEW.taxa_aquisicao, 0);
    st := COALESCE(NEW.sessoes_totais, 0);
    sm := COALESCE(NEW.sessoes_midia, 0);
    it := COALESCE(NEW.investimento_total, 0);
  END IF;

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

-- 3. RPC media_historica — média dos últimos 6 meses realizados anteriores a (p_ano, p_mes)
CREATE OR REPLACE FUNCTION public.media_historica(p_ano integer, p_mes integer)
RETURNS TABLE (
  taxa_conversao numeric,
  ticket_medio numeric,
  taxa_aprovacao numeric,
  taxa_aquisicao numeric,
  cps_midia numeric,
  sessoes_organicas numeric,
  sessoes_totais numeric,
  receita_captada numeric,
  pedidos_captados numeric,
  investimento_total numeric,
  roas_faturado numeric,
  cac_novos numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ult AS (
    SELECT *
    FROM public.planejamento_mensal
    WHERE tipo = 'realizado'
      AND (ano < p_ano OR (ano = p_ano AND mes < p_mes))
    ORDER BY ano DESC, mes DESC
    LIMIT 6
  )
  SELECT
    AVG(taxa_conversao),
    AVG(ticket_medio_geral),
    AVG(taxa_aprovacao),
    AVG(taxa_aquisicao),
    AVG(cps_midia),
    AVG(GREATEST(COALESCE(sessoes_totais,0) - COALESCE(sessoes_midia,0), 0)),
    AVG(sessoes_totais),
    AVG(receita_captada),
    AVG(pedidos_captados),
    AVG(investimento_total),
    AVG(roas_faturado),
    AVG(cac_novos)
  FROM ult;
$$;

GRANT EXECUTE ON FUNCTION public.media_historica(integer, integer) TO anon, authenticated, service_role;
