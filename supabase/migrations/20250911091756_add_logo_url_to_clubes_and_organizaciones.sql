-- Add logo_url column to clubes table
ALTER TABLE public.clubes 
ADD COLUMN logo_url TEXT NULL;

-- Add comment to the new column
COMMENT ON COLUMN public.clubes.logo_url IS 'URL of the club logo image stored in Supabase Storage';

-- Add logo_url column to organizaciones table  
ALTER TABLE public.organizaciones 
ADD COLUMN logo_url TEXT NULL;

-- Add comment to the new column
COMMENT ON COLUMN public.organizaciones.logo_url IS 'URL of the organization logo image stored in Supabase Storage';