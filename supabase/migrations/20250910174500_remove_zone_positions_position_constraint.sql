-- Remove position check constraint from zone_positions table
-- This constraint was limiting positions to 1-4, but long tournaments
-- can have more couples per zone (e.g., 6 couples = positions 1-6)

ALTER TABLE zone_positions 
DROP CONSTRAINT IF EXISTS zone_positions_position_check;

-- Add a comment explaining why we removed the constraint
COMMENT ON COLUMN zone_positions.position IS 
'Position of the couple in the zone (1 = first place). No upper limit constraint to support tournaments with varying zone sizes.';