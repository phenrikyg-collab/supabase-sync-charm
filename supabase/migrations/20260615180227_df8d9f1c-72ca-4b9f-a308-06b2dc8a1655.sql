
-- Full unique index on fingerprint_hash (NULLs are allowed multiple times by default)
CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_financeiras_fingerprint_hash_uidx
  ON public.movimentacoes_financeiras(fingerprint_hash);

CREATE OR REPLACE FUNCTION public.sync_vindi_taxa_to_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_gateway uuid := '3169efce-c262-40d3-89f0-3b4f919b8183';
  v_fp text;
  v_data date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM movimentacoes_financeiras WHERE fingerprint_hash = 'vindi_taxa_' || OLD.id;
    RETURN OLD;
  END IF;

  v_fp := 'vindi_taxa_' || NEW.id;
  v_data := COALESCE(NEW.data_credito, NEW.data_transacao);

  IF lower(COALESCE(NEW.status,'')) LIKE 'aprov%' AND COALESCE(NEW.taxa,0) > 0 AND v_data IS NOT NULL THEN
    INSERT INTO movimentacoes_financeiras (
      tipo, descricao, valor, data, categoria_id, origem,
      fingerprint_hash, tipo_origem, impacta_dre, impacta_fluxo,
      status_pagamento, cliente
    ) VALUES (
      'saida',
      'Taxa Vindi - Pedido ' || COALESCE(NULLIF(NEW.numero_pedido,''), NEW.id),
      NEW.taxa, v_data, v_cat_gateway, 'vindi',
      v_fp, 'vindi_taxa', true, true, 'pago', NEW.cliente
    )
    ON CONFLICT (fingerprint_hash) DO UPDATE SET
      valor = EXCLUDED.valor,
      data = EXCLUDED.data,
      descricao = EXCLUDED.descricao,
      cliente = EXCLUDED.cliente,
      categoria_id = EXCLUDED.categoria_id,
      status_pagamento = 'pago',
      impacta_dre = true,
      impacta_fluxo = true;
  ELSE
    DELETE FROM movimentacoes_financeiras WHERE fingerprint_hash = v_fp;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vindi_taxa ON public.vindi_transacoes;
CREATE TRIGGER trg_sync_vindi_taxa
AFTER INSERT OR UPDATE OR DELETE ON public.vindi_transacoes
FOR EACH ROW EXECUTE FUNCTION public.sync_vindi_taxa_to_financeiro();

INSERT INTO movimentacoes_financeiras (
  tipo, descricao, valor, data, categoria_id, origem,
  fingerprint_hash, tipo_origem, impacta_dre, impacta_fluxo,
  status_pagamento, cliente
)
SELECT
  'saida',
  'Taxa Vindi - Pedido ' || COALESCE(NULLIF(v.numero_pedido,''), v.id),
  v.taxa,
  COALESCE(v.data_credito, v.data_transacao),
  '3169efce-c262-40d3-89f0-3b4f919b8183',
  'vindi',
  'vindi_taxa_' || v.id,
  'vindi_taxa',
  true, true, 'pago', v.cliente
FROM vindi_transacoes v
WHERE lower(COALESCE(v.status,'')) LIKE 'aprov%'
  AND COALESCE(v.taxa,0) > 0
  AND COALESCE(v.data_credito, v.data_transacao) IS NOT NULL
ON CONFLICT (fingerprint_hash) DO UPDATE SET
  valor = EXCLUDED.valor,
  data = EXCLUDED.data,
  descricao = EXCLUDED.descricao,
  cliente = EXCLUDED.cliente,
  categoria_id = EXCLUDED.categoria_id,
  status_pagamento = 'pago',
  impacta_dre = true,
  impacta_fluxo = true;
