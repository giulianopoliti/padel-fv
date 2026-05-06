-- Add organizador_id field to tournaments table for efficient organizador ownership queries
-- This allows direct organizador → tournament relationship without complex JOINs

ALTER TABLE tournaments 
ADD COLUMN organizador_id UUID REFERENCES users(id);

-- Add index for performance on organizador queries
CREATE INDEX IF NOT EXISTS idx_tournaments_organizador_id 
ON tournaments(organizador_id);

-- Add comment to document the field purpose  
COMMENT ON COLUMN tournaments.organizador_id IS 'Direct reference to organizador user who created this tournament. Enables fast ownership queries without complex JOINs through organization_members → organization_clubs';