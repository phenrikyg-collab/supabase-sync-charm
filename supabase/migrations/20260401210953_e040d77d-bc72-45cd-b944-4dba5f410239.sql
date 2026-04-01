
CREATE TABLE public.registros_producao_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  ordem_producao_id uuid REFERENCES public.ordens_producao(id) ON DELETE CASCADE NOT NULL,
  costureira_id uuid REFERENCES public.costureiras(id) ON DELETE CASCADE NOT NULL,
  pecas_produzidas integer NOT NULL DEFAULT 0,
  pecas_defeituosas integer NOT NULL DEFAULT 0,
  tempo_reta numeric NOT NULL DEFAULT 0,
  tempo_overloque numeric NOT NULL DEFAULT 0,
  tempo_galoneira numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.registros_producao_diaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read registros_producao_diaria" ON public.registros_producao_diaria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert registros_producao_diaria" ON public.registros_producao_diaria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update registros_producao_diaria" ON public.registros_producao_diaria FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete registros_producao_diaria" ON public.registros_producao_diaria FOR DELETE TO authenticated USING (true);
