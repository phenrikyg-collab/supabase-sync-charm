ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS frequencia_tipo text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frequencia_meses integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recorrencia_grupo_id uuid DEFAULT NULL;