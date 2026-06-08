-- Tabela para registrar alterações do prazo de envio (estimated_delivery_date)
-- com justificativa obrigatória. Rodar no projeto externo ezdtulcrqzmgocamjwwl.

CREATE TABLE IF NOT EXISTS public.expedicao_alteracoes_prazo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id text NOT NULL,
  prazo_anterior date,
  prazo_novo date NOT NULL,
  justificativa text NOT NULL,
  alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.expedicao_alteracoes_prazo TO authenticated;
GRANT ALL ON public.expedicao_alteracoes_prazo TO service_role;

ALTER TABLE public.expedicao_alteracoes_prazo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read alteracoes prazo" ON public.expedicao_alteracoes_prazo;
CREATE POLICY "auth read alteracoes prazo"
  ON public.expedicao_alteracoes_prazo
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth insert alteracoes prazo" ON public.expedicao_alteracoes_prazo;
CREATE POLICY "auth insert alteracoes prazo"
  ON public.expedicao_alteracoes_prazo
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_alt_prazo_pedido ON public.expedicao_alteracoes_prazo(pedido_id);
