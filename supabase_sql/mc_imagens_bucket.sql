-- Run on the EXTERNAL Supabase project (ezdtulcrqzmgocamjwwl)
-- Creates the 'mc-imagens' storage bucket used by Matriz Criativa > Hospedagem de Imagens
-- and restricts access to authenticated users only.

-- =========================================================
-- 1) Create bucket (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('mc-imagens', 'mc-imagens', false)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- 2) Policies on storage.objects for 'mc-imagens'
-- =========================================================
DROP POLICY IF EXISTS "mc_imagens_select" ON storage.objects;
DROP POLICY IF EXISTS "mc_imagens_insert" ON storage.objects;
DROP POLICY IF EXISTS "mc_imagens_update" ON storage.objects;
DROP POLICY IF EXISTS "mc_imagens_delete" ON storage.objects;

CREATE POLICY "mc_imagens_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'mc-imagens');
CREATE POLICY "mc_imagens_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mc-imagens');
CREATE POLICY "mc_imagens_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mc-imagens') WITH CHECK (bucket_id = 'mc-imagens');
CREATE POLICY "mc_imagens_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'mc-imagens');
