
-- Tabela principal de planos de produção
CREATE TABLE public.planos_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_producao_id UUID NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  oficina_id UUID REFERENCES public.oficinas(id),
  data_planejada DATE NOT NULL,
  horas_disponiveis NUMERIC NOT NULL DEFAULT 8,
  pecas_planejadas INTEGER NOT NULL DEFAULT 0,
  segundos_utilizados NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planejado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planos_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read planos_producao" ON public.planos_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert planos_producao" ON public.planos_producao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update planos_producao" ON public.planos_producao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete planos_producao" ON public.planos_producao FOR DELETE TO authenticated USING (true);

-- Tabela de etapas de cada dia do plano
CREATE TABLE public.planos_producao_etapas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_producao_id UUID NOT NULL REFERENCES public.planos_producao(id) ON DELETE CASCADE,
  tipo_maquina TEXT NOT NULL DEFAULT 'reta',
  numero_etapa INTEGER NOT NULL DEFAULT 1,
  nome_etapa TEXT NOT NULL DEFAULT '',
  tempo_segundos_por_peca NUMERIC NOT NULL DEFAULT 0,
  pecas_planejadas INTEGER NOT NULL DEFAULT 0,
  segundos_utilizados NUMERIC NOT NULL DEFAULT 0,
  capacidade_segundos_dia NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planos_producao_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read planos_producao_etapas" ON public.planos_producao_etapas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert planos_producao_etapas" ON public.planos_producao_etapas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update planos_producao_etapas" ON public.planos_producao_etapas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete planos_producao_etapas" ON public.planos_producao_etapas FOR DELETE TO authenticated USING (true);
