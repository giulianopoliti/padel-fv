-- Add gallery fields to organizaciones table
-- This allows organizations to manage their own cover image and gallery images

ALTER TABLE organizaciones
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the purpose
COMMENT ON COLUMN organizaciones.cover_image_url IS 'URL of the organization cover/header image stored in Supabase Storage';
COMMENT ON COLUMN organizaciones.gallery_images IS 'Array of image URLs for the organization gallery stored in Supabase Storage';
