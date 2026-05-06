-- Disable RLS on storage.objects for public access to organizaciones bucket
-- This allows public read access to all images in the organizaciones bucket

-- First, ensure the bucket is marked as public
UPDATE storage.buckets
SET public = true
WHERE id = 'organizaciones';

-- Drop all existing policies for organizaciones bucket
DROP POLICY IF EXISTS "Public can view organizaciones images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to organizaciones" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own organization images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own organization images" ON storage.objects;

-- Create a permissive SELECT policy for public access (anon role)
CREATE POLICY "Public access to organizaciones bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'organizaciones');

-- Create INSERT policy for authenticated users
CREATE POLICY "Authenticated users can upload to organizaciones"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'organizaciones');

-- Create UPDATE policy for authenticated users
CREATE POLICY "Authenticated users can update organizaciones"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'organizaciones');

-- Create DELETE policy for authenticated users
CREATE POLICY "Authenticated users can delete from organizaciones"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'organizaciones');
