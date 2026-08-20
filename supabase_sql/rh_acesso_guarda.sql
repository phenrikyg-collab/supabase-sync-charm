-- =====================================================================
-- RH · guarda de acesso obrigatória em todas as RPCs public.rh_*
-- Rodar no projeto Supabase externo (backend do ERP).
-- Idempotente: funções que já têm a guarda não são alteradas.
-- =====================================================================

-- 1) Guarda central --------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_acesso_exigir()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: área de RH restrita (requer módulo RH ou perfil admin)'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin') THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_modules WHERE user_id = v_uid AND module = 'rh') THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Acesso negado: área de RH restrita (requer módulo RH ou perfil admin)'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.rh_acesso_exigir() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rh_acesso_exigir() TO authenticated, service_role;

-- 2) Conferência: quais rh_* ainda estão sem guarda -------------------
SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS funcao,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'rh\_%'
  AND p.proname <> 'rh_acesso_exigir'
  AND p.prosrc NOT ILIKE '%rh_acesso_exigir%'
ORDER BY 1;

-- 3) Injeção automática da guarda como PRIMEIRA instrução -------------
--    Só toca em funções plpgsql que ainda NÃO possuem a chamada,
--    preservando qualquer guarda já existente.
DO $patch$
DECLARE
  r        record;
  v_def    text;
  v_novo   text;
  v_pos    int;
  v_feitas text[] := '{}';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND l.lanname = 'plpgsql'
      AND p.proname LIKE 'rh\_%'
      AND p.proname <> 'rh_acesso_exigir'
      AND p.prosrc NOT ILIKE '%rh_acesso_exigir%'
  LOOP
    v_def := pg_get_functiondef(r.oid);

    -- localiza o primeiro BEGIN do corpo (início do bloco executável)
    v_pos := (regexp_match(v_def, '\mBEGIN\M', 'i'))[1] IS NOT NULL
             AND true;
    v_novo := regexp_replace(
      v_def,
      '(\mBEGIN\M)',
      E'\\1\n  PERFORM public.rh_acesso_exigir();',
      'i'
    );

    IF v_novo = v_def THEN
      RAISE NOTICE 'PULADA (sem BEGIN identificável): %', r.proname;
      CONTINUE;
    END IF;

    EXECUTE v_novo;
    v_feitas := v_feitas || r.proname;
  END LOOP;

  RAISE NOTICE 'Funções protegidas: %', v_feitas;
END;
$patch$;

-- 4) Fecha o acesso anônimo às RPCs de RH -----------------------------
DO $grants$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'rh\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', r.sig);
  END LOOP;
END;
$grants$;

-- 5) Verificação final (deve voltar vazio) ----------------------------
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'rh\_%'
  AND p.proname <> 'rh_acesso_exigir'
  AND p.prosrc NOT ILIKE '%rh_acesso_exigir%';
