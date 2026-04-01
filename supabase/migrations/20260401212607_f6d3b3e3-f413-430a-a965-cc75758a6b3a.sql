
ALTER TABLE public.fichas_tecnicas_tempo
  ADD COLUMN IF NOT EXISTS numero_etapa integer NOT NULL DEFAULT 1;
