
-- Config de máquinas
CREATE TABLE public.config_maquinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_maquina text NOT NULL,
  quantidade_maquinas integer NOT NULL DEFAULT 1,
  horas_por_dia numeric NOT NULL DEFAULT 8,
  dias_uteis_mes integer NOT NULL DEFAULT 22,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.config_maquinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read config_maquinas" ON public.config_maquinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert config_maquinas" ON public.config_maquinas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update config_maquinas" ON public.config_maquinas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete config_maquinas" ON public.config_maquinas FOR DELETE TO authenticated USING (true);

-- Fichas técnicas de tempo
CREATE TABLE public.fichas_tecnicas_tempo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  tipo_peca text NOT NULL DEFAULT 'Recorrente',
  operacao text NOT NULL,
  tempo_minutos numeric NOT NULL DEFAULT 0,
  cronometrado_por text,
  data_medicao date,
  num_amostras integer,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fichas_tecnicas_tempo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read fichas_tecnicas_tempo" ON public.fichas_tecnicas_tempo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert fichas_tecnicas_tempo" ON public.fichas_tecnicas_tempo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update fichas_tecnicas_tempo" ON public.fichas_tecnicas_tempo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete fichas_tecnicas_tempo" ON public.fichas_tecnicas_tempo FOR DELETE TO authenticated USING (true);
