
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS foto_url text;

-- Create storage bucket for collaborator photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('colaboradores-fotos', 'colaboradores-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'colaboradores-fotos');

-- Allow public read access
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'colaboradores-fotos');

-- Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'colaboradores-fotos');
