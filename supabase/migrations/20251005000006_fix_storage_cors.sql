-- Fix CORS configuration for storage buckets
-- This resolves ERR_BLOCKED_BY_ORB errors when loading images

-- Update organizaciones bucket with proper CORS settings
UPDATE storage.buckets
SET
  public = true,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  file_size_limit = 5242880
WHERE id = 'organizaciones';

-- Update clubes bucket with proper CORS settings
UPDATE storage.buckets
SET
  public = true,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  file_size_limit = 5242880
WHERE id = 'clubes';

-- Note: RLS is already enabled by default on storage.objects in Supabase
-- Note: Permissions are already granted by default to anon role for public buckets
