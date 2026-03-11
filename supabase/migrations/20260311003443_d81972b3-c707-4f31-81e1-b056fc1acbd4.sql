
-- Colaboradores (para aniversariantes e escala de limpeza)
CREATE TABLE public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  data_nascimento DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read colaboradores"
  ON public.colaboradores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert colaboradores"
  ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update colaboradores"
  ON public.colaboradores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete colaboradores"
  ON public.colaboradores FOR DELETE TO authenticated USING (true);

-- Escala de limpeza
CREATE TABLE public.escala_limpeza (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escala_limpeza ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read escala_limpeza"
  ON public.escala_limpeza FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert escala_limpeza"
  ON public.escala_limpeza FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete escala_limpeza"
  ON public.escala_limpeza FOR DELETE TO authenticated USING (true);

-- Avisos do mural
CREATE TABLE public.avisos_mural (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT,
  prioridade INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos_mural ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read avisos_mural"
  ON public.avisos_mural FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert avisos_mural"
  ON public.avisos_mural FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update avisos_mural"
  ON public.avisos_mural FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete avisos_mural"
  ON public.avisos_mural FOR DELETE TO authenticated USING (true);
