-- =====================================================================
-- Corte -> Ordem de Produção -> Portal da Oficina -> Pagamento
-- Rodar no projeto Supabase externo (backend do ERP), em DUAS partes.
-- Não cria nem altera cadastro de produtos/modelos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PARTE 1 (rodar sozinha primeiro: valor novo de enum precisa de commit)
-- ---------------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'oficina';

-- ---------------------------------------------------------------------
-- PARTE 2
-- ---------------------------------------------------------------------

-- 1) Vínculo usuário -> oficina ---------------------------------------
CREATE TABLE IF NOT EXISTS public.oficina_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.oficina_usuarios TO authenticated;
GRANT ALL ON public.oficina_usuarios TO service_role;
ALTER TABLE public.oficina_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oficina_usuarios_ver" ON public.oficina_usuarios;
CREATE POLICY "oficina_usuarios_ver" ON public.oficina_usuarios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2) Colunas novas em ordens_producao -------------------------------
ALTER TABLE public.ordens_producao
  ADD COLUMN IF NOT EXISTS quantidade_entregue integer,
  ADD COLUMN IF NOT EXISTS data_entrega date,
  ADD COLUMN IF NOT EXISTS data_pagamento date;

-- 3) Funções auxiliares --------------------------------------------
CREATE OR REPLACE FUNCTION public.minha_oficina_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT oficina_id FROM public.oficina_usuarios WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.eh_usuario_oficina()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'oficina')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
$$;

-- 4) RLS: usuário de oficina só enxerga o que é dele ----------------
-- Políticas RESTRITIVAS: somam-se às existentes sem afetar a equipe interna.
DROP POLICY IF EXISTS "op_restrito_oficina" ON public.ordens_producao;
CREATE POLICY "op_restrito_oficina" ON public.ordens_producao AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (NOT public.eh_usuario_oficina() OR oficina_id = public.minha_oficina_id())
  WITH CHECK (NOT public.eh_usuario_oficina() OR oficina_id = public.minha_oficina_id());

DROP POLICY IF EXISTS "op_oficina_ver" ON public.ordens_producao;
CREATE POLICY "op_oficina_ver" ON public.ordens_producao
  FOR SELECT TO authenticated
  USING (public.eh_usuario_oficina() AND oficina_id = public.minha_oficina_id());

DROP POLICY IF EXISTS "oficinas_restrito_oficina" ON public.oficinas;
CREATE POLICY "oficinas_restrito_oficina" ON public.oficinas AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (NOT public.eh_usuario_oficina() OR id = public.minha_oficina_id())
  WITH CHECK (NOT public.eh_usuario_oficina());

DROP POLICY IF EXISTS "oficinas_oficina_ver" ON public.oficinas;
CREATE POLICY "oficinas_oficina_ver" ON public.oficinas
  FOR SELECT TO authenticated
  USING (public.eh_usuario_oficina() AND id = public.minha_oficina_id());

DROP POLICY IF EXISTS "grade_restrito_oficina" ON public.ordens_corte_grade;
CREATE POLICY "grade_restrito_oficina" ON public.ordens_corte_grade AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (NOT public.eh_usuario_oficina() OR EXISTS (
    SELECT 1 FROM public.ordens_producao op
    WHERE op.ordem_corte_id = ordens_corte_grade.ordem_corte_id
      AND op.oficina_id = public.minha_oficina_id()))
  WITH CHECK (NOT public.eh_usuario_oficina());

DROP POLICY IF EXISTS "grade_oficina_ver" ON public.ordens_corte_grade;
CREATE POLICY "grade_oficina_ver" ON public.ordens_corte_grade
  FOR SELECT TO authenticated
  USING (public.eh_usuario_oficina() AND EXISTS (
    SELECT 1 FROM public.ordens_producao op
    WHERE op.ordem_corte_id = ordens_corte_grade.ordem_corte_id
      AND op.oficina_id = public.minha_oficina_id()));

-- Oficina não enxerga financeiro, rolos nem ordens de corte da loja.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['movimentacoes_financeiras','rolos_tecido','ordens_corte','ordens_corte_rolos','cartoes_faturas']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "bloqueia_oficina" ON public.%I', t);
    EXECUTE format('CREATE POLICY "bloqueia_oficina" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.eh_usuario_oficina()) WITH CHECK (NOT public.eh_usuario_oficina())', t);
  END LOOP;
END $$;

-- Produtos e cores: leitura para a oficina montar a tela.
DROP POLICY IF EXISTS "produtos_oficina_ver" ON public.produtos;
CREATE POLICY "produtos_oficina_ver" ON public.produtos FOR SELECT TO authenticated
  USING (public.eh_usuario_oficina());
DROP POLICY IF EXISTS "cores_oficina_ver" ON public.cores;
CREATE POLICY "cores_oficina_ver" ON public.cores FOR SELECT TO authenticated
  USING (public.eh_usuario_oficina());

-- 5) Criar ordem de corte + débito de rolos + OPs (uma transação) ----
-- p = { status, metragem_risco, quantidade_folhas, grade_tamanhos[],
--       produtos:[{produto_id,nome_produto}],
--       grade:[{produto_id,cor_id,tamanho,quantidade}]  (quantidade = peças cortadas)
--       rolos:[{rolo_id,metragem_utilizada}] }
CREATE OR REPLACE FUNCTION public.criar_ordem_corte(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY');
  v_seq int;
  v_numero text;
  v_oc uuid;
  v_total numeric := 0;
  r jsonb;
  v_ops int := 0;
BEGIN
  IF auth.uid() IS NULL OR public.eh_usuario_oficina() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p->>'status','Planejada') NOT IN ('Planejada','Cortada') THEN
    RAISE EXCEPTION 'Status inicial inválido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ordens_corte_numero'));
  SELECT COALESCE(MAX(substring(numero_oc FROM '^OC-' || v_ano || '-(\d+)$')::int), 0) + 1
    INTO v_seq FROM public.ordens_corte WHERE numero_oc LIKE 'OC-' || v_ano || '-%';
  v_numero := 'OC-' || v_ano || '-' || lpad(v_seq::text, 3, '0');

  SELECT COALESCE(SUM((x->>'metragem_utilizada')::numeric), 0) INTO v_total
    FROM jsonb_array_elements(COALESCE(p->'rolos','[]')) x;

  INSERT INTO public.ordens_corte (numero_oc, grade_tamanhos, metragem_risco, metragem_total_utilizada, quantidade_folhas, status)
  VALUES (
    v_numero,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'grade_tamanhos','[]'))),
    NULLIF(p->>'metragem_risco','')::numeric,
    v_total,
    NULLIF(p->>'quantidade_folhas','')::int,
    COALESCE(p->>'status','Planejada')
  ) RETURNING id INTO v_oc;

  INSERT INTO public.ordens_corte_produtos (ordem_corte_id, produto_id, nome_produto)
  SELECT v_oc, (x->>'produto_id')::uuid, x->>'nome_produto'
  FROM jsonb_array_elements(COALESCE(p->'produtos','[]')) x;

  INSERT INTO public.ordens_corte_grade (ordem_corte_id, produto_id, cor_id, tamanho, quantidade)
  SELECT v_oc, NULLIF(x->>'produto_id','')::uuid, NULLIF(x->>'cor_id','')::uuid, x->>'tamanho', (x->>'quantidade')::int
  FROM jsonb_array_elements(COALESCE(p->'grade','[]')) x
  WHERE (x->>'quantidade')::int > 0;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p->'rolos','[]')) LOOP
    UPDATE public.rolos_tecido
       SET metragem_disponivel = metragem_disponivel - (r->>'metragem_utilizada')::numeric
     WHERE id = (r->>'rolo_id')::uuid
       AND COALESCE(metragem_disponivel,0) >= (r->>'metragem_utilizada')::numeric;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rolo sem metragem suficiente (%)', r->>'rolo_id';
    END IF;
    INSERT INTO public.ordens_corte_rolos (ordem_corte_id, rolo_id, metragem_utilizada)
    VALUES (v_oc, (r->>'rolo_id')::uuid, (r->>'metragem_utilizada')::numeric);
  END LOOP;

  -- Uma OP por produto + cor, oficina em branco para atribuição manual.
  INSERT INTO public.ordens_producao (produto_id, cor_id, ordem_corte_id, nome_produto, quantidade, quantidade_pecas_ordem, status_ordem, oficina_id)
  SELECT g.produto_id, g.cor_id, v_oc, pr.nome_do_produto, SUM(g.quantidade), SUM(g.quantidade), 'Corte', NULL
  FROM public.ordens_corte_grade g
  LEFT JOIN public.produtos pr ON pr.id = g.produto_id
  WHERE g.ordem_corte_id = v_oc
  GROUP BY g.produto_id, g.cor_id, pr.nome_do_produto;
  GET DIAGNOSTICS v_ops = ROW_COUNT;

  RETURN jsonb_build_object('id', v_oc, 'numero_oc', v_numero, 'ops_criadas', v_ops);
END $$;
REVOKE ALL ON FUNCTION public.criar_ordem_corte(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_ordem_corte(jsonb) TO authenticated;

-- 6) Baixa pela oficina --------------------------------------------
CREATE OR REPLACE FUNCTION public.oficina_dar_baixa(p_op_id uuid, p_quantidade int, p_data date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oficina uuid;
BEGIN
  SELECT oficina_id INTO v_oficina FROM public.ordens_producao WHERE id = p_op_id;
  IF v_oficina IS NULL THEN RAISE EXCEPTION 'Ordem sem oficina'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR v_oficina = public.minha_oficina_id()) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  UPDATE public.ordens_producao
     SET quantidade_entregue = p_quantidade,
         data_entrega = COALESCE(p_data, CURRENT_DATE),
         data_fim = COALESCE(p_data, CURRENT_DATE),
         status_ordem = 'Entregue',
         pagamento_oficina_status = CASE WHEN pagamento_oficina_status = 'Pago' THEN 'Pago' ELSE 'A pagar' END
   WHERE id = p_op_id;
END $$;
REVOKE ALL ON FUNCTION public.oficina_dar_baixa(uuid,int,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.oficina_dar_baixa(uuid,int,date) TO authenticated;

-- 7) Marcar pago (admin) + lançamento no financeiro por oficina -----
CREATE OR REPLACE FUNCTION public.pagamento_oficinas_marcar_pago(p_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_total numeric := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  FOR g IN
    SELECT o.id AS oficina_id, o.nome_oficina,
           SUM(COALESCE(op.quantidade_entregue, op.quantidade, op.quantidade_pecas_ordem, 0) * COALESCE(o.custo_por_peca,0)) AS valor,
           COUNT(*) AS qtd
    FROM public.ordens_producao op JOIN public.oficinas o ON o.id = op.oficina_id
    WHERE op.id = ANY(p_ids) AND COALESCE(op.pagamento_oficina_status,'') <> 'Pago'
    GROUP BY o.id, o.nome_oficina
  LOOP
    INSERT INTO public.movimentacoes_financeiras (tipo, descricao, valor, data, origem)
    VALUES ('Saída', 'Pagamento oficina ' || COALESCE(g.nome_oficina,'-') || ' - ' || g.qtd || ' OP(s)', g.valor, CURRENT_DATE, 'Pagamento Oficina');
    v_total := v_total + g.valor;
  END LOOP;
  UPDATE public.ordens_producao
     SET pagamento_oficina_status = 'Pago', data_pagamento = CURRENT_DATE
   WHERE id = ANY(p_ids) AND COALESCE(pagamento_oficina_status,'') <> 'Pago';
  RETURN jsonb_build_object('total', v_total);
END $$;
REVOKE ALL ON FUNCTION public.pagamento_oficinas_marcar_pago(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pagamento_oficinas_marcar_pago(uuid[]) TO authenticated;

-- 8) Vincular usuário (por e-mail) a uma oficina (admin) -----------
CREATE OR REPLACE FUNCTION public.oficina_vincular_usuario(p_email text, p_oficina_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado: crie o login antes em Usuários'; END IF;
  INSERT INTO public.oficina_usuarios (user_id, oficina_id) VALUES (v_uid, p_oficina_id)
    ON CONFLICT (user_id) DO UPDATE SET oficina_id = EXCLUDED.oficina_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'oficina')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.oficina_vincular_usuario(text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.oficina_vincular_usuario(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.oficina_usuarios_listar()
RETURNS TABLE(user_id uuid, email text, oficina_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT ou.user_id, u.email::text, ou.oficina_id
    FROM public.oficina_usuarios ou JOIN auth.users u ON u.id = ou.user_id;
END $$;
REVOKE ALL ON FUNCTION public.oficina_usuarios_listar() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.oficina_usuarios_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.oficina_desvincular_usuario(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.oficina_usuarios WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role::text = 'oficina';
END $$;
REVOKE ALL ON FUNCTION public.oficina_desvincular_usuario(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.oficina_desvincular_usuario(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
