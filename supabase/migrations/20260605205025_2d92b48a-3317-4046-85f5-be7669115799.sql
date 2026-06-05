CREATE TABLE IF NOT EXISTS public.mc_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  foto_url text NOT NULL,
  foto_estudio_url text,
  adequada_para text[] NOT NULL DEFAULT ARRAY['todos']::text[],
  faixa_etaria text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_modelos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_modelos TO anon;
GRANT ALL ON public.mc_modelos TO service_role;

ALTER TABLE public.mc_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mc_modelos_all ON public.mc_modelos;
CREATE POLICY mc_modelos_all ON public.mc_modelos
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.mc_modelos_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS mc_modelos_updated_at ON public.mc_modelos;
CREATE TRIGGER mc_modelos_updated_at BEFORE UPDATE ON public.mc_modelos
  FOR EACH ROW EXECUTE FUNCTION public.mc_modelos_set_updated_at();