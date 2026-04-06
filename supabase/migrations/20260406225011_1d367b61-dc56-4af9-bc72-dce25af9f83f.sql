
CREATE TABLE public.cartoes_credito (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  dia_vencimento integer NOT NULL DEFAULT 10,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read cartoes_credito" ON public.cartoes_credito FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert cartoes_credito" ON public.cartoes_credito FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cartoes_credito" ON public.cartoes_credito FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete cartoes_credito" ON public.cartoes_credito FOR DELETE TO authenticated USING (true);
