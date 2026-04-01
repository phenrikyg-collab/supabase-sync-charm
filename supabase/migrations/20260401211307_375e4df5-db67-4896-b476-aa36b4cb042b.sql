
-- Config de prazo de revisão
CREATE TABLE public.config_bonificacao_revisoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prazo_revisao_dias_uteis integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.config_bonificacao_revisoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read config_bonificacao_revisoras" ON public.config_bonificacao_revisoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert config_bonificacao_revisoras" ON public.config_bonificacao_revisoras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update config_bonificacao_revisoras" ON public.config_bonificacao_revisoras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete config_bonificacao_revisoras" ON public.config_bonificacao_revisoras FOR DELETE TO authenticated USING (true);

-- Registros de revisão
CREATE TABLE public.registros_revisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revisora_id uuid REFERENCES public.revisoras(id) ON DELETE CASCADE NOT NULL,
  ordem_producao_id uuid REFERENCES public.ordens_producao(id) ON DELETE CASCADE NOT NULL,
  data_recebimento date NOT NULL,
  data_conclusao date,
  quantidade_pecas integer NOT NULL DEFAULT 0,
  pecas_aprovadas integer NOT NULL DEFAULT 0,
  pecas_reprovadas integer NOT NULL DEFAULT 0,
  observacao text,
  dias_uteis_gastos integer,
  dentro_prazo boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.registros_revisao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read registros_revisao" ON public.registros_revisao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert registros_revisao" ON public.registros_revisao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update registros_revisao" ON public.registros_revisao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete registros_revisao" ON public.registros_revisao FOR DELETE TO authenticated USING (true);

-- Defeitos mensais
CREATE TABLE public.defeitos_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia text NOT NULL UNIQUE,
  total_pecas_expedidas integer NOT NULL DEFAULT 0,
  total_defeitos_reportados integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.defeitos_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read defeitos_mensais" ON public.defeitos_mensais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert defeitos_mensais" ON public.defeitos_mensais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update defeitos_mensais" ON public.defeitos_mensais FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete defeitos_mensais" ON public.defeitos_mensais FOR DELETE TO authenticated USING (true);
