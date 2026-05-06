-- Add scheduling fields to fecha_matches for flexible match scheduling
-- This allows organizers to set specific times independent of tournament_time_slots

ALTER TABLE fecha_matches 
ADD COLUMN scheduled_date DATE,
ADD COLUMN scheduled_start_time TIME,
ADD COLUMN scheduled_end_time TIME,
ADD COLUMN court_assignment TEXT;

-- Make scheduled_time_slot_id optional since organizers can now set custom times
ALTER TABLE fecha_matches 
ALTER COLUMN scheduled_time_slot_id DROP NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN fecha_matches.scheduled_date IS 'Specific date when match is scheduled to be played';
COMMENT ON COLUMN fecha_matches.scheduled_start_time IS 'Specific start time for the match';
COMMENT ON COLUMN fecha_matches.scheduled_end_time IS 'Specific end time for the match';
COMMENT ON COLUMN fecha_matches.court_assignment IS 'Specific court assigned for the match';
COMMENT ON COLUMN fecha_matches.scheduled_time_slot_id IS 'Optional reference to tournament_time_slots, can be null for custom scheduling';

-- Add index for scheduling queries
CREATE INDEX idx_fecha_matches_schedule ON fecha_matches(scheduled_date, scheduled_start_time) WHERE scheduled_date IS NOT NULL;