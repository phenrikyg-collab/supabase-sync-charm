
-- Ensure the trigger for updating fatura balances is active
DROP TRIGGER IF EXISTS trg_atualizar_saldo_fatura ON public.movimentacoes_financeiras;

CREATE TRIGGER trg_atualizar_saldo_fatura
  AFTER INSERT OR UPDATE OR DELETE ON public.movimentacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_fatura();

-- Add unique constraint for cartao_nome + data_vencimento on cartoes_faturas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_cartao_vencimento'
  ) THEN
    ALTER TABLE public.cartoes_faturas
      ADD CONSTRAINT uq_cartao_vencimento UNIQUE (cartao_nome, data_vencimento);
  END IF;
END $$;
