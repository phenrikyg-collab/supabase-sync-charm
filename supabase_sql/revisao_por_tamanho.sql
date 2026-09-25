-- ============================================================
-- Revisão por tamanho (Ordem de Produção)
-- Rodar de uma vez no banco. Pode rodar de novo sem problema.
-- Depende de: public.has_role (já existe).
-- ============================================================

-- 1) Detalhe por tamanho, ligado ao registro de revisão
CREATE TABLE IF NOT EXISTS public.registros_revisao_grade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_revisao_id uuid NOT NULL REFERENCES public.registros_revisao(id) ON DELETE CASCADE,
  tamanho text NOT NULL,
  pecas_aprovadas integer NOT NULL DEFAULT 0 CHECK (pecas_aprovadas >= 0),
  pecas_reprovadas integer NOT NULL DEFAULT 0 CHECK (pecas_reprovadas >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registro_revisao_id, tamanho)
);
CREATE INDEX IF NOT EXISTS idx_rrg_registro ON public.registros_revisao_grade(registro_revisao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_revisao_grade TO authenticated;
GRANT ALL ON public.registros_revisao_grade TO service_role;

ALTER TABLE public.registros_revisao_grade ENABLE ROW LEVEL SECURITY;

-- Equipe interna (qualquer login que não seja só de oficina) lê e grava.
DROP POLICY IF EXISTS "Equipe gerencia revisao por tamanho" ON public.registros_revisao_grade;
CREATE POLICY "Equipe gerencia revisao por tamanho" ON public.registros_revisao_grade
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'oficina'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'oficina'));

CREATE OR REPLACE FUNCTION public.registros_revisao_grade_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_rrg_touch ON public.registros_revisao_grade;
CREATE TRIGGER trg_rrg_touch BEFORE UPDATE ON public.registros_revisao_grade
  FOR EACH ROW EXECUTE FUNCTION public.registros_revisao_grade_touch();

-- 2) Salvar a revisão por tamanho em uma só operação (tudo ou nada).
--    Se a OP já tem revisão, atualiza a mais recente; senão cria.
--    Totais = soma dos tamanhos. status_ordem passa para 'Revisada'.
--    p = { op_id, revisora_id, data_recebimento, data_conclusao, observacao,
--          dias_uteis_gastos, dentro_prazo, tamanhos: [{tamanho, aprovadas, reprovadas}] }
CREATE OR REPLACE FUNCTION public.revisao_salvar_por_tamanho(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_op uuid := (p->>'op_id')::uuid;
  v_reg uuid;
  v_apr int; v_rep int;
  t jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = 'oficina')
     AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  IF v_op IS NULL OR NULLIF(p->>'revisora_id','') IS NULL OR NULLIF(p->>'data_recebimento','') IS NULL THEN
    RAISE EXCEPTION 'campos_obrigatorios';
  END IF;
  IF jsonb_array_length(COALESCE(p->'tamanhos','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'sem_tamanhos';
  END IF;

  SELECT COALESCE(SUM(GREATEST((x->>'aprovadas')::int,0)),0),
         COALESCE(SUM(GREATEST((x->>'reprovadas')::int,0)),0)
    INTO v_apr, v_rep
  FROM jsonb_array_elements(p->'tamanhos') x;

  SELECT id INTO v_reg FROM registros_revisao
   WHERE ordem_producao_id = v_op ORDER BY created_at DESC LIMIT 1;

  IF v_reg IS NULL THEN
    INSERT INTO registros_revisao (revisora_id, ordem_producao_id, data_recebimento, data_conclusao,
      quantidade_pecas, pecas_aprovadas, pecas_reprovadas, observacao, dias_uteis_gastos, dentro_prazo)
    VALUES ((p->>'revisora_id')::uuid, v_op, (p->>'data_recebimento')::date,
      NULLIF(p->>'data_conclusao','')::date, v_apr + v_rep, v_apr, v_rep,
      NULLIF(p->>'observacao',''), NULLIF(p->>'dias_uteis_gastos','')::int,
      NULLIF(p->>'dentro_prazo','')::boolean)
    RETURNING id INTO v_reg;
  ELSE
    UPDATE registros_revisao SET
      revisora_id = (p->>'revisora_id')::uuid,
      data_recebimento = (p->>'data_recebimento')::date,
      data_conclusao = NULLIF(p->>'data_conclusao','')::date,
      quantidade_pecas = v_apr + v_rep,
      pecas_aprovadas = v_apr,
      pecas_reprovadas = v_rep,
      observacao = NULLIF(p->>'observacao',''),
      dias_uteis_gastos = NULLIF(p->>'dias_uteis_gastos','')::int,
      dentro_prazo = NULLIF(p->>'dentro_prazo','')::boolean
    WHERE id = v_reg;
    DELETE FROM registros_revisao_grade WHERE registro_revisao_id = v_reg;
  END IF;

  FOR t IN SELECT * FROM jsonb_array_elements(p->'tamanhos') LOOP
    INSERT INTO registros_revisao_grade (registro_revisao_id, tamanho, pecas_aprovadas, pecas_reprovadas)
    VALUES (v_reg, t->>'tamanho', GREATEST((t->>'aprovadas')::int,0), GREATEST((t->>'reprovadas')::int,0));
  END LOOP;

  UPDATE ordens_producao SET status_ordem = 'Revisada' WHERE id = v_op;

  RETURN jsonb_build_object('registro_revisao_id', v_reg, 'aprovadas', v_apr, 'reprovadas', v_rep);
END $$;

REVOKE ALL ON FUNCTION public.revisao_salvar_por_tamanho(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revisao_salvar_por_tamanho(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
