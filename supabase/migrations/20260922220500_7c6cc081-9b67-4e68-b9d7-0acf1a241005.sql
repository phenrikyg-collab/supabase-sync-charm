DO $$
DECLARE
  t text;
  p record;
  tabelas text[] := ARRAY[
    'planejamento_simulacoes','produtos','categorias_financeiras','defeitos_mensais','registros_revisao',
    'avisos_mural','centros_custos','metas_whatsapp','ordens_corte_produtos','custo_fixo_oficina',
    'ordens_corte','colaboradores','revisoras','mc_modelos','metas_whatsapp_consultoras',
    'bonus_costureiras','planos_producao','ordens_corte_rolos','fichas_tecnicas_tempo','consertos',
    'bonus_revisoras','ordens_producao','config_bonificacao_whatsapp','entradas_tecido',
    'config_bonificacao_revisoras','planos_producao_etapas','bonus_whatsapp_apurados','ordens_corte_grade',
    'costureiras','consultoras_whatsapp','rolos_tecido','oficinas','config_maquinas',
    'registros_producao_diaria','cores','tecidos','config_bonificacao_costureiras','planejamento_mensal',
    'escala_limpeza'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND (coalesce(qual, 'true') = 'true' AND coalesce(with_check, 'true') = 'true')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Admins manage %s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))',
      t, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated users can view colaboradores photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "modelos_marca_select" ON storage.objects;
DROP POLICY IF EXISTS "modelos_marca_insert" ON storage.objects;
DROP POLICY IF EXISTS "modelos_marca_update" ON storage.objects;
DROP POLICY IF EXISTS "modelos_marca_delete" ON storage.objects;
DROP POLICY IF EXISTS "mc_imagens_authenticated_all" ON storage.objects;

CREATE POLICY "Owners or admins read private buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('colaboradores-fotos','modelos-marca','mc-imagens')
    AND (owner_id = (SELECT auth.uid()::text) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE POLICY "Owners upload private buckets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('colaboradores-fotos','modelos-marca','mc-imagens')
    AND owner_id = (SELECT auth.uid()::text)
  );

CREATE POLICY "Owners or admins update private buckets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('colaboradores-fotos','modelos-marca','mc-imagens')
    AND (owner_id = (SELECT auth.uid()::text) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
  WITH CHECK (
    bucket_id IN ('colaboradores-fotos','modelos-marca','mc-imagens')
    AND owner_id = (SELECT auth.uid()::text)
  );

CREATE POLICY "Owners or admins delete private buckets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('colaboradores-fotos','modelos-marca','mc-imagens')
    AND (owner_id = (SELECT auth.uid()::text) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );