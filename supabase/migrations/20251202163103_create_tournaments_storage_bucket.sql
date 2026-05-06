-- =====================================================
-- MIGRATION: Create tournaments storage bucket
-- =====================================================
-- This migration creates the 'tournaments' storage bucket
-- with the exact same configuration as in production.
-- Includes RLS policies for public read access and
-- authenticated user write access.
-- =====================================================

-- 1. Create the tournaments bucket (idempotent with ON CONFLICT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tournaments',
  'tournaments',
  true,          -- Public bucket (read access for everyone)
  NULL,          -- No file size limit
  NULL           -- No MIME type restrictions
)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects (already enabled by Supabase, skip to avoid permission error)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for tournaments bucket (idempotent with DROP IF EXISTS)

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Public can view tournaments objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to tournaments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update tournaments objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete tournaments objects" ON storage.objects;

-- Policy 1: Public read access - Anyone can view tournament images
CREATE POLICY "Public can view tournaments objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'tournaments');

-- Policy 2: Authenticated users can upload - Users must be logged in to upload
CREATE POLICY "Authenticated users can upload to tournaments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tournaments' AND
  auth.role() = 'authenticated'
);

-- Policy 3: Authenticated users can update - Users must be logged in to update
CREATE POLICY "Authenticated users can update tournaments objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tournaments' AND
  auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'tournaments' AND
  auth.role() = 'authenticated'
);

-- Policy 4: Authenticated users can delete - Users must be logged in to delete
CREATE POLICY "Authenticated users can delete tournaments objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tournaments' AND
  auth.role() = 'authenticated'
);

-- =====================================================
-- NOTES:
-- - This configuration matches production exactly
-- - The bucket will be recreated on every db reset
-- - ON CONFLICT ensures idempotency
-- =====================================================
