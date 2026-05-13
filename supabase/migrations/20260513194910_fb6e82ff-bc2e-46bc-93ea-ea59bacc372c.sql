-- 1. Consultoras
CREATE TABLE IF NOT EXISTS public.consultoras_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  apelido_canal text,
  point_sale_patterns text[] DEFAULT '{}',
  telefone text,
  meta_individual numeric,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consultoras_whatsapp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all consultoras_whatsapp" ON public.consultoras_whatsapp;
CREATE POLICY "auth all consultoras_whatsapp" ON public.consultoras_whatsapp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Meta mensal do canal
CREATE TABLE IF NOT EXISTS public.metas_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia text NOT NULL UNIQUE,
  meta_total numeric NOT NULL DEFAULT 0,
  modo_distribuicao text NOT NULL DEFAULT 'proporcional',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.metas_whatsapp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all metas_whatsapp" ON public.metas_whatsapp;
CREATE POLICY "auth all metas_whatsapp" ON public.metas_whatsapp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Meta individual por consultora/mês
CREATE TABLE IF NOT EXISTS public.metas_whatsapp_consultoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia text NOT NULL,
  consultora_id uuid NOT NULL,
  meta_valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mes_referencia, consultora_id)
);
ALTER TABLE public.metas_whatsapp_consultoras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all metas_whatsapp_consultoras" ON public.metas_whatsapp_consultoras;
CREATE POLICY "auth all metas_whatsapp_consultoras" ON public.metas_whatsapp_consultoras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Configuração das regras de bonificação
CREATE TABLE IF NOT EXISTS public.config_bonificacao_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faixas_meta jsonb NOT NULL,
  regras_desconto jsonb NOT NULL,
  faixas_ticket jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  vigencia_inicio date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.config_bonificacao_whatsapp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all config_bonificacao_whatsapp" ON public.config_bonificacao_whatsapp;
CREATE POLICY "auth all config_bonificacao_whatsapp" ON public.config_bonificacao_whatsapp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.config_bonificacao_whatsapp (faixas_meta, regras_desconto, faixas_ticket, ativo)
SELECT
  '[
     {"min_pct":0,    "max_pct":94.99, "bonus_base":0,    "label":"Abaixo da meta"},
     {"min_pct":95,   "max_pct":109.99,"bonus_base":500,  "label":"Meta"},
     {"min_pct":110,  "max_pct":119.99,"bonus_base":900,  "label":"Super meta"},
     {"min_pct":120,  "max_pct":99999, "bonus_base":1500, "label":"Top performer"}
   ]'::jsonb,
  '[
     {"max_pct":6,    "multiplicador":1.0},
     {"max_pct":10,   "multiplicador":0.7},
     {"max_pct":15,   "multiplicador":0.5},
     {"max_pct":99999,"multiplicador":0.0}
   ]'::jsonb,
  '[
     {"min_valor":380, "acelerador":100},
     {"min_valor":420, "acelerador":250},
     {"min_valor":500, "acelerador":500}
   ]'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.config_bonificacao_whatsapp WHERE ativo = true);

-- 5. Apurações (snapshot mensal congelado)
CREATE TABLE IF NOT EXISTS public.bonus_whatsapp_apurados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia text NOT NULL,
  consultora_id uuid NOT NULL,
  faturamento_liquido numeric NOT NULL DEFAULT 0,
  meta numeric NOT NULL DEFAULT 0,
  pct_atingimento numeric NOT NULL DEFAULT 0,
  ticket_medio numeric NOT NULL DEFAULT 0,
  desconto_medio_pct numeric NOT NULL DEFAULT 0,
  qtd_pedidos integer NOT NULL DEFAULT 0,
  bonus_base numeric NOT NULL DEFAULT 0,
  multiplicador_desconto numeric NOT NULL DEFAULT 0,
  acelerador_ticket numeric NOT NULL DEFAULT 0,
  bonus_final numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'projetado',
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes_referencia, consultora_id)
);
ALTER TABLE public.bonus_whatsapp_apurados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all bonus_whatsapp_apurados" ON public.bonus_whatsapp_apurados;
CREATE POLICY "auth all bonus_whatsapp_apurados" ON public.bonus_whatsapp_apurados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);