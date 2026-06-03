
CREATE TABLE public.planejamento_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  tipo text NOT NULL CHECK (tipo IN ('planejado','realizado')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado','fechado')),
  receita_captada numeric,
  taxa_aprovacao numeric,
  pedidos_captados numeric,
  taxa_aquisicao numeric,
  sessoes_totais numeric,
  sessoes_midia numeric,
  investimento_total numeric,
  receita_faturada numeric,
  receita_aquisicao numeric,
  receita_retencao numeric,
  pedidos_faturados numeric,
  pedidos_aquisicao numeric,
  pedidos_retencao numeric,
  taxa_retencao numeric,
  ticket_medio_aquisicao numeric,
  ticket_medio_retencao numeric,
  ticket_medio_geral numeric,
  cps_geral numeric,
  cps_midia numeric,
  cac_novos numeric,
  cac_geral numeric,
  roas_faturado numeric,
  adcost_pct numeric,
  peso_mes_pct numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano, mes, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_mensal TO authenticated, anon;
GRANT ALL ON public.planejamento_mensal TO service_role;

ALTER TABLE public.planejamento_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planejamento_mensal_all" ON public.planejamento_mensal FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.planejamento_mensal_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
  NEW.pedidos_faturados := pf;
  NEW.pedidos_aquisicao := pa;
  NEW.receita_aquisicao := ra;
  NEW.pedidos_retencao := pr;
  NEW.receita_retencao := rr;
  NEW.taxa_retencao := CASE WHEN ta IS NULL THEN NULL ELSE 100 - tq END;
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
END $$;

CREATE TRIGGER trg_planejamento_mensal_calc
BEFORE INSERT OR UPDATE ON public.planejamento_mensal
FOR EACH ROW EXECUTE FUNCTION public.planejamento_mensal_calc();

CREATE TABLE public.planejamento_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ano int NOT NULL,
  mes int NOT NULL,
  base jsonb NOT NULL,
  cenarios jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_simulacoes TO authenticated, anon;
GRANT ALL ON public.planejamento_simulacoes TO service_role;
ALTER TABLE public.planejamento_simulacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planejamento_simulacoes_all" ON public.planejamento_simulacoes FOR ALL USING (true) WITH CHECK (true);
