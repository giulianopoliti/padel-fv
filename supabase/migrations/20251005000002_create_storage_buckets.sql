-- Create storage buckets if they don't exist

-- Create clubes bucket for club and organization images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clubes',
  'clubes',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for clubes bucket
CREATE POLICY "Public can view clubes images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'clubes');

CREATE POLICY "Authenticated users can upload to clubes" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'clubes'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own club images" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'clubes'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own club images" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'clubes'
    AND auth.role() = 'authenticated'
  );
