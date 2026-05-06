-- Create organizaciones bucket for organization images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organizaciones',
  'organizaciones',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view organizaciones images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to organizaciones" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own organization images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own organization images" ON storage.objects;

-- Create RLS policies for organizaciones bucket
CREATE POLICY "Public can view organizaciones images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'organizaciones');

CREATE POLICY "Authenticated users can upload to organizaciones" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'organizaciones'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own organization images" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'organizaciones'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own organization images" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'organizaciones'
    AND auth.role() = 'authenticated'
  );
