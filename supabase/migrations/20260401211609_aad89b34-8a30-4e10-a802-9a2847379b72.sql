
-- Config bonificação costureiras (single row with all bonus parameters)
CREATE TABLE public.config_bonificacao_costureiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Prazo
  bonus_prazo_no_prazo numeric NOT NULL DEFAULT 50,
  bonus_prazo_1_dia_atraso numeric NOT NULL DEFAULT 30,
  bonus_prazo_2_dias_atraso numeric NOT NULL DEFAULT 15,
  bonus_prazo_acima_2_dias numeric NOT NULL DEFAULT 0,
  -- Qualidade
  bonus_qualidade_0_pct numeric NOT NULL DEFAULT 60,
  bonus_qualidade_ate_1_pct numeric NOT NULL DEFAULT 40,
  bonus_qualidade_ate_3_pct numeric NOT NULL DEFAULT 20,
  bonus_qualidade_acima_3_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.config_bonificacao_costureiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read config_bonificacao_costureiras" ON public.config_bonificacao_costureiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert config_bonificacao_costureiras" ON public.config_bonificacao_costureiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update config_bonificacao_costureiras" ON public.config_bonificacao_costureiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete config_bonificacao_costureiras" ON public.config_bonificacao_costureiras FOR DELETE TO authenticated USING (true);

-- Seed default config
INSERT INTO public.config_bonificacao_costureiras DEFAULT VALUES;

-- Add bonus fields to config_bonificacao_revisoras
ALTER TABLE public.config_bonificacao_revisoras
  ADD COLUMN IF NOT EXISTS bonus_prazo_dentro numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS bonus_prazo_fora numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_defeito_0_pct numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS bonus_defeito_ate_1_pct numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS bonus_defeito_ate_3_pct numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS bonus_defeito_acima_3_pct numeric NOT NULL DEFAULT 0;

-- bonus_costureiras
CREATE TABLE public.bonus_costureiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id uuid NOT NULL REFERENCES public.ordens_producao(id),
  costureira_id uuid NOT NULL REFERENCES public.costureiras(id),
  bonus_prazo numeric NOT NULL DEFAULT 0,
  bonus_qualidade numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ordem_producao_id, costureira_id)
);

ALTER TABLE public.bonus_costureiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bonus_costureiras" ON public.bonus_costureiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bonus_costureiras" ON public.bonus_costureiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bonus_costureiras" ON public.bonus_costureiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete bonus_costureiras" ON public.bonus_costureiras FOR DELETE TO authenticated USING (true);

-- bonus_revisoras
CREATE TABLE public.bonus_revisoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revisora_id uuid NOT NULL REFERENCES public.revisoras(id),
  mes_referencia text NOT NULL,
  bonus_prazo numeric NOT NULL DEFAULT 0,
  bonus_qualidade numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(revisora_id, mes_referencia)
);

ALTER TABLE public.bonus_revisoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bonus_revisoras" ON public.bonus_revisoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bonus_revisoras" ON public.bonus_revisoras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bonus_revisoras" ON public.bonus_revisoras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete bonus_revisoras" ON public.bonus_revisoras FOR DELETE TO authenticated USING (true);

-- View: vw_revisao_mensal
CREATE OR REPLACE VIEW public.vw_revisao_mensal AS
SELECT
  r.revisora_id,
  rev.nome AS revisora_nome,
  to_char(r.data_recebimento, 'YYYY-MM') AS mes,
  COUNT(*) AS total_revisoes,
  SUM(r.quantidade_pecas) AS total_pecas,
  SUM(r.pecas_aprovadas) AS total_aprovadas,
  SUM(r.pecas_reprovadas) AS total_reprovadas,
  COUNT(*) FILTER (WHERE r.dentro_prazo = true) AS revisoes_no_prazo,
  COUNT(*) FILTER (WHERE r.dentro_prazo = false) AS revisoes_fora_prazo,
  CASE WHEN COUNT(*) FILTER (WHERE r.dentro_prazo IS NOT NULL) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE r.dentro_prazo = true)::numeric / COUNT(*) FILTER (WHERE r.dentro_prazo IS NOT NULL) * 100, 1)
    ELSE 0 END AS pct_prazo
FROM public.registros_revisao r
JOIN public.revisoras rev ON rev.id = r.revisora_id
GROUP BY r.revisora_id, rev.nome, to_char(r.data_recebimento, 'YYYY-MM');
