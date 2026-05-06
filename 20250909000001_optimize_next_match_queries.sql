-- Optimization migration for "next pending match" queries
-- This migration creates essential indexes for fast player-to-match lookups

-- 1. CRITICAL: Create indexes on couples table for player lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_couples_player1_id 
  ON public.couples (player1_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_couples_player2_id 
  ON public.couples (player2_id);

-- 2. Composite index for efficient player-couple lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_couples_both_players 
  ON public.couples (player1_id, player2_id);

-- 3. Optimize matches table for status-based queries  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_status_tournament 
  ON public.matches (status, tournament_id) 
  WHERE status IN ('PENDING', 'IN_PROGRESS');

-- 4. Composite index for couple-status lookups in matches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_couples_status 
  ON public.matches (couple1_id, couple2_id, status) 
  WHERE status IN ('PENDING', 'IN_PROGRESS');

-- 5. Optimize fecha_matches for schedule information
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fecha_matches_match_scheduling 
  ON public.fecha_matches (match_id, scheduled_date, scheduled_start_time);

-- Comments explaining the optimization
COMMENT ON INDEX idx_couples_player1_id IS 'Optimizes player-to-couple lookups for next match queries';
COMMENT ON INDEX idx_couples_player2_id IS 'Optimizes player-to-couple lookups for next match queries';  
COMMENT ON INDEX idx_couples_both_players IS 'Composite index for efficient player-couple relationships';
COMMENT ON INDEX idx_matches_status_tournament IS 'Optimizes pending/in-progress match queries by tournament';
COMMENT ON INDEX idx_matches_couples_status IS 'Optimizes couple-to-match lookups with status filtering';
COMMENT ON INDEX idx_fecha_matches_match_scheduling IS 'Optimizes match scheduling information retrieval';