-- Create index for DRAFT status filtering
-- This migration must run AFTER the DRAFT enum value has been added
-- (separate transaction required by PostgreSQL)

-- Create index for performance when filtering out DRAFT matches
CREATE INDEX IF NOT EXISTS idx_matches_status_published
ON matches (tournament_id, status)
WHERE status != 'DRAFT';

COMMENT ON INDEX idx_matches_status_published IS 'Optimizes queries that exclude DRAFT matches (for player views)';
