
CREATE TABLE IF NOT EXISTS public.vindi_transacoes (
  id text PRIMARY KEY,
  data_transacao date,
  numero_pedido text,
  cliente text,
  email_cliente text,
  meio_pagamento text,
  parcelas integer,
  valor_pago numeric,
  valor_frete numeric,
  valor_loja numeric,
  taxa numeric,
  taxa_percentual numeric,
  data_credito date,
  status text,
  codigo_rastreio text,
  nsu text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vindi_transacoes TO authenticated;
GRANT ALL ON public.vindi_transacoes TO service_role;

ALTER TABLE public.vindi_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vindi_transacoes"
  ON public.vindi_transacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vindi_transacoes"
  ON public.vindi_transacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vindi_transacoes"
  ON public.vindi_transacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete vindi_transacoes"
  ON public.vindi_transacoes FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_vindi_transacoes_data ON public.vindi_transacoes(data_transacao);
CREATE INDEX IF NOT EXISTS idx_vindi_transacoes_status ON public.vindi_transacoes(status);
