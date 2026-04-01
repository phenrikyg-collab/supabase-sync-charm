
-- Tabela costureiras
CREATE TABLE public.costureiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  funcao text NOT NULL DEFAULT 'Reta',
  participacao_pct numeric NOT NULL DEFAULT 20,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.costureiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read costureiras" ON public.costureiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert costureiras" ON public.costureiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update costureiras" ON public.costureiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete costureiras" ON public.costureiras FOR DELETE TO authenticated USING (true);

-- Tabela revisoras
CREATE TABLE public.revisoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.revisoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read revisoras" ON public.revisoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert revisoras" ON public.revisoras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update revisoras" ON public.revisoras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete revisoras" ON public.revisoras FOR DELETE TO authenticated USING (true);
