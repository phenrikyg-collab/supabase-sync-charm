ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS fingerprint_hash text,
  ADD COLUMN IF NOT EXISTS tipo_origem text;

CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_financeiras_fingerprint_hash_key
  ON public.movimentacoes_financeiras (fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;