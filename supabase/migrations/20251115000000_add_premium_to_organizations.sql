-- Migration: Add premium flag to organizations
-- Description: Adds is_premium boolean field to organizaciones table to differentiate
--              premium tier organizations that get featured placement on home page

-- Add premium column to organizaciones table
ALTER TABLE organizaciones
ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN organizaciones.is_premium IS
'Premium tier organizations get featured placement on home page with full card design including cover image, stats, and CTA button. Non-premium organizations show compact logo-only cards.';

-- Note: No index needed as this is_premium filtering won't be a performance bottleneck
