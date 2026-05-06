-- Make fecha_id nullable in fecha_matches
-- This allows bracket matches to be scheduled independently without requiring a tournament_fecha
-- Bracket matches (FINAL, SEMIFINAL, 4TOS, etc.) don't need to be tied to specific "fechas"
-- which are primarily used for organizing zone phase matches

-- Remove NOT NULL constraint from fecha_id
ALTER TABLE fecha_matches
ALTER COLUMN fecha_id DROP NOT NULL;

-- Add comment explaining the nullable behavior
COMMENT ON COLUMN fecha_matches.fecha_id IS 'Optional reference to tournament_fecha. NULL for bracket matches that are scheduled independently.';

-- Update index to handle NULL values efficiently
DROP INDEX IF EXISTS idx_fecha_matches_fecha_id;
CREATE INDEX idx_fecha_matches_fecha_id ON fecha_matches(fecha_id) WHERE fecha_id IS NOT NULL;

-- Add index for matches without fecha_id (bracket matches)
CREATE INDEX idx_fecha_matches_no_fecha ON fecha_matches(match_id) WHERE fecha_id IS NULL;

-- Add check to ensure match_id is always unique (already exists but ensuring it's clear)
-- This constraint already exists: unique_match_in_fecha on match_id
-- A match can only appear once in fecha_matches regardless of fecha_id

-- Add helpful comment on the table
COMMENT ON TABLE fecha_matches IS 'Links matches to fechas (for zone matches) or provides scheduling data for bracket matches (fecha_id can be NULL).';
