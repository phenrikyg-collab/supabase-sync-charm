
-- Adicionar colunas impacta_dre e impacta_fluxo
ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS impacta_dre boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS impacta_fluxo boolean NOT NULL DEFAULT true;

-- Retroativamente marcar movimentações existentes de cartão de crédito
-- (conta_tipo = 'cartao_fatura' ou 'pagamento_cartao')
UPDATE public.movimentacoes_financeiras
SET impacta_dre = false, impacta_fluxo = true
WHERE conta_tipo = 'pagamento_cartao';

-- Criar trigger para ativar a função atualizar_saldo_fatura
CREATE TRIGGER trg_atualizar_saldo_fatura
  AFTER INSERT OR UPDATE OR DELETE ON public.movimentacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_fatura();
