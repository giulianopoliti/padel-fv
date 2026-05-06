-- Add sets tracking fields to zone_positions table
-- This migration adds sets_for, sets_against, and sets_difference columns
-- to track set-level statistics for tournament positions

-- Add sets tracking columns to zone_positions
ALTER TABLE zone_positions 
ADD COLUMN sets_for smallint DEFAULT 0,
ADD COLUMN sets_against smallint DEFAULT 0,
ADD COLUMN sets_difference smallint DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN zone_positions.sets_for IS 'Total sets won by this couple in this zone';
COMMENT ON COLUMN zone_positions.sets_against IS 'Total sets lost by this couple in this zone';
COMMENT ON COLUMN zone_positions.sets_difference IS 'Difference between sets_for and sets_against';

-- Update existing records to have default values
UPDATE zone_positions 
SET sets_for = 0, sets_against = 0, sets_difference = 0 
WHERE sets_for IS NULL OR sets_against IS NULL OR sets_difference IS NULL;

-- Make columns NOT NULL after setting defaults
ALTER TABLE zone_positions 
ALTER COLUMN sets_for SET NOT NULL,
ALTER COLUMN sets_against SET NOT NULL,
ALTER COLUMN sets_difference SET NOT NULL;
