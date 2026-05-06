-- Migration: Remove is_qualifying column from tournament_fechas
-- The is_qualifying field is deprecated in favor of the new round_type field
-- round_type provides more granular control over tournament phases

-- Drop any indexes that might reference is_qualifying
DROP INDEX IF EXISTS "idx_tournament_fechas_is_qualifying";

-- Remove the is_qualifying column from tournament_fechas
ALTER TABLE "public"."tournament_fechas"
DROP COLUMN IF EXISTS "is_qualifying";

-- Add comment for documentation
COMMENT ON TABLE "public"."tournament_fechas"
IS 'Tournament dates table. Use round_type field to determine tournament phase instead of deprecated is_qualifying field';