-- Performance Optimization Migration
-- Adding critical indexes and optimized views for tournament system

-- ============================================================================
-- CRITICAL PERFORMANCE INDEXES
-- ============================================================================

-- 1. For couples table - optimize player lookups (panel-cpa dashboard)
CREATE INDEX IF NOT EXISTS idx_couples_players_composite 
ON couples (player1_id, player2_id) 
WHERE es_prueba = false;

-- 2. For players table - optimize user to couple lookups
CREATE INDEX IF NOT EXISTS idx_players_user_couple_lookup 
ON players (user_id, id) 
WHERE user_id IS NOT NULL;

-- 3. For matches table - optimize "next match" queries
CREATE INDEX IF NOT EXISTS idx_matches_player_status 
ON matches (couple1_id, couple2_id, status, tournament_id) 
WHERE status IN ('PENDING', 'IN_PROGRESS') AND es_prueba = false;

-- 4. For tournaments table - optimize active tournament lookups
CREATE INDEX IF NOT EXISTS idx_tournaments_active_lookup 
ON tournaments (status, start_date, end_date) 
WHERE es_prueba = false;

-- 5. For inscriptions table - optimize tournament-couple joins
CREATE INDEX IF NOT EXISTS idx_inscriptions_tournament_couple 
ON inscriptions (tournament_id, couple_id) 
WHERE es_prueba = false;

-- ============================================================================
-- INDEXES FOR LONG TOURNAMENT FEATURE
-- ============================================================================

-- NOTE: couple_availability and tournament_dates tables were dropped in
-- migration 20250904043022_drop_unused_duplicate_tables.sql
-- Keeping couple_time_availability and tournament_fechas instead

-- 6. For couple_time_availability - optimize availability queries
CREATE INDEX IF NOT EXISTS idx_couple_time_availability_lookup
ON couple_time_availability (couple_id, time_slot_id, is_available);

-- 7. For tournament_fechas - optimize active dates lookup
CREATE INDEX IF NOT EXISTS idx_tournament_fechas_active_lookup
ON tournament_fechas (tournament_id, fecha_number, status)
WHERE status IN ('SCHEDULING', 'IN_PROGRESS');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_couples_players_composite IS 'Optimize player-couple lookups for dashboard queries';
COMMENT ON INDEX idx_players_user_couple_lookup IS 'Fast user to player/couple resolution';
COMMENT ON INDEX idx_matches_player_status IS 'Optimize next match queries for active matches';