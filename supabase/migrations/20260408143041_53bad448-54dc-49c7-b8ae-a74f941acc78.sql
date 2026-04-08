
CREATE TABLE public.orcamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  valor_orcado numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (categoria_id, mes, ano)
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (true);
