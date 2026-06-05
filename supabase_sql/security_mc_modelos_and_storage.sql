-- Run on the EXTERNAL Supabase project (ezdtulcrqzmgocamjwwl)
-- Fixes:
-- 1) mc_modelos open-to-anon policy -> restrict to authenticated
-- 2) modelos-marca private bucket without policies -> add authenticated-only policies

-- =========================================================
-- 1) mc_modelos: drop permissive anon policies, add auth-only
-- =========================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mc_modelos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mc_modelos', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.mc_modelos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mc_modelos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_modelos TO authenticated;
GRANT ALL ON public.mc_modelos TO service_role;

CREATE POLICY "mc_modelos_auth_select" ON public.mc_modelos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "mc_modelos_auth_insert" ON public.mc_modelos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mc_modelos_auth_update" ON public.mc_modelos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mc_modelos_auth_delete" ON public.mc_modelos
  FOR DELETE TO authenticated USING (true);

-- =========================================================
-- 2) Storage bucket 'modelos-marca': authenticated-only access
-- =========================================================
DROP POLICY IF EXISTS "modelos_marca_select" ON storage.objects;
DROP POLICY IF EXISTS "modelos_marca_insert" ON storage.objects;
DROP POLICY IF EXISTS "modelos_marca_update" ON storage.objects;
DROP POLICY IF EXISTS "modelos_marca_delete" ON storage.objects;

CREATE POLICY "modelos_marca_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'modelos-marca');
CREATE POLICY "modelos_marca_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'modelos-marca');
CREATE POLICY "modelos_marca_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'modelos-marca') WITH CHECK (bucket_id = 'modelos-marca');
CREATE POLICY "modelos_marca_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'modelos-marca');
