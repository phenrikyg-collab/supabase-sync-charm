
-- 1. Criar tabela cartoes_faturas
CREATE TABLE public.cartoes_faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_nome text NOT NULL,
  mes_referencia text NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  saldo_em_aberto numeric GENERATED ALWAYS AS (COALESCE(valor_total, 0) - COALESCE(valor_pago, 0)) STORED,
  status text NOT NULL DEFAULT 'aberta',
  data_vencimento date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cartoes_faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read cartoes_faturas" ON public.cartoes_faturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert cartoes_faturas" ON public.cartoes_faturas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cartoes_faturas" ON public.cartoes_faturas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete cartoes_faturas" ON public.cartoes_faturas FOR DELETE TO authenticated USING (true);

-- 2. Adicionar colunas em movimentacoes_financeiras
ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS conta_tipo text,
  ADD COLUMN IF NOT EXISTS fatura_id uuid REFERENCES public.cartoes_faturas(id) ON DELETE SET NULL;

-- 3. Função para atualizar saldo da fatura
CREATE OR REPLACE FUNCTION public.atualizar_saldo_fatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_pago_novo numeric;
  v_valor_total numeric;
  v_status text;
BEGIN
  -- INSERT: somar valor do novo pagamento
  IF TG_OP = 'INSERT' THEN
    IF NEW.conta_tipo = 'pagamento_cartao' AND NEW.fatura_id IS NOT NULL THEN
      UPDATE cartoes_faturas
      SET valor_pago = COALESCE(valor_pago, 0) + ABS(COALESCE(NEW.valor, 0))
      WHERE id = NEW.fatura_id;

      -- Atualizar status
      SELECT COALESCE(valor_pago, 0), COALESCE(valor_total, 0)
      INTO v_valor_pago_novo, v_valor_total
      FROM cartoes_faturas WHERE id = NEW.fatura_id;

      IF v_valor_pago_novo >= v_valor_total AND v_valor_total > 0 THEN
        v_status := 'paga';
      ELSIF v_valor_pago_novo > 0 THEN
        v_status := 'parcial';
      ELSE
        v_status := 'aberta';
      END IF;

      UPDATE cartoes_faturas SET status = v_status WHERE id = NEW.fatura_id;
    END IF;
    RETURN NEW;

  -- UPDATE: ajustar diferença
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverter antigo se era pagamento_cartao
    IF OLD.conta_tipo = 'pagamento_cartao' AND OLD.fatura_id IS NOT NULL THEN
      UPDATE cartoes_faturas
      SET valor_pago = COALESCE(valor_pago, 0) - ABS(COALESCE(OLD.valor, 0))
      WHERE id = OLD.fatura_id;
    END IF;
    -- Aplicar novo se é pagamento_cartao
    IF NEW.conta_tipo = 'pagamento_cartao' AND NEW.fatura_id IS NOT NULL THEN
      UPDATE cartoes_faturas
      SET valor_pago = COALESCE(valor_pago, 0) + ABS(COALESCE(NEW.valor, 0))
      WHERE id = NEW.fatura_id;
    END IF;

    -- Recalcular status para ambas faturas (old e new)
    FOR v_valor_pago_novo, v_valor_total IN
      SELECT COALESCE(cf.valor_pago, 0), COALESCE(cf.valor_total, 0)
      FROM cartoes_faturas cf
      WHERE cf.id IN (OLD.fatura_id, NEW.fatura_id) AND cf.id IS NOT NULL
    LOOP
      IF v_valor_pago_novo >= v_valor_total AND v_valor_total > 0 THEN
        v_status := 'paga';
      ELSIF v_valor_pago_novo > 0 THEN
        v_status := 'parcial';
      ELSE
        v_status := 'aberta';
      END IF;
    END LOOP;

    -- Update status for both faturas
    IF OLD.fatura_id IS NOT NULL THEN
      SELECT COALESCE(valor_pago, 0), COALESCE(valor_total, 0)
      INTO v_valor_pago_novo, v_valor_total
      FROM cartoes_faturas WHERE id = OLD.fatura_id;
      IF v_valor_pago_novo >= v_valor_total AND v_valor_total > 0 THEN
        UPDATE cartoes_faturas SET status = 'paga' WHERE id = OLD.fatura_id;
      ELSIF v_valor_pago_novo > 0 THEN
        UPDATE cartoes_faturas SET status = 'parcial' WHERE id = OLD.fatura_id;
      ELSE
        UPDATE cartoes_faturas SET status = 'aberta' WHERE id = OLD.fatura_id;
      END IF;
    END IF;

    IF NEW.fatura_id IS NOT NULL THEN
      SELECT COALESCE(valor_pago, 0), COALESCE(valor_total, 0)
      INTO v_valor_pago_novo, v_valor_total
      FROM cartoes_faturas WHERE id = NEW.fatura_id;
      IF v_valor_pago_novo >= v_valor_total AND v_valor_total > 0 THEN
        UPDATE cartoes_faturas SET status = 'paga' WHERE id = NEW.fatura_id;
      ELSIF v_valor_pago_novo > 0 THEN
        UPDATE cartoes_faturas SET status = 'parcial' WHERE id = NEW.fatura_id;
      ELSE
        UPDATE cartoes_faturas SET status = 'aberta' WHERE id = NEW.fatura_id;
      END IF;
    END IF;

    RETURN NEW;

  -- DELETE: reverter pagamento
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.conta_tipo = 'pagamento_cartao' AND OLD.fatura_id IS NOT NULL THEN
      UPDATE cartoes_faturas
      SET valor_pago = GREATEST(COALESCE(valor_pago, 0) - ABS(COALESCE(OLD.valor, 0)), 0)
      WHERE id = OLD.fatura_id;

      SELECT COALESCE(valor_pago, 0), COALESCE(valor_total, 0)
      INTO v_valor_pago_novo, v_valor_total
      FROM cartoes_faturas WHERE id = OLD.fatura_id;

      IF v_valor_pago_novo >= v_valor_total AND v_valor_total > 0 THEN
        v_status := 'paga';
      ELSIF v_valor_pago_novo > 0 THEN
        v_status := 'parcial';
      ELSE
        v_status := 'aberta';
      END IF;

      UPDATE cartoes_faturas SET status = v_status WHERE id = OLD.fatura_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 4. Triggers
CREATE TRIGGER trg_atualizar_saldo_fatura_insert
  AFTER INSERT ON public.movimentacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_fatura();

CREATE TRIGGER trg_atualizar_saldo_fatura_update
  AFTER UPDATE ON public.movimentacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_fatura();

CREATE TRIGGER trg_atualizar_saldo_fatura_delete
  AFTER DELETE ON public.movimentacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_fatura();
