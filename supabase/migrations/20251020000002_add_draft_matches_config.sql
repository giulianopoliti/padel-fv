-- Add draft matches configuration to tournaments table
-- When enabled, newly created matches start in DRAFT status and must be manually published

ALTER TABLE tournaments
ADD COLUMN enable_draft_matches BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN tournaments.enable_draft_matches IS 'When enabled, matches are created in DRAFT status and must be manually published by the organizer. Players cannot see DRAFT matches.';

-- Create index for tournaments using draft mode
CREATE INDEX IF NOT EXISTS idx_tournaments_draft_enabled
ON tournaments (id, enable_draft_matches)
WHERE enable_draft_matches = true;

COMMENT ON INDEX idx_tournaments_draft_enabled IS 'Optimizes queries checking if a tournament has draft mode enabled';
