-- Drop unused duplicate tables
-- tournament_dates is not used in code (only tournament_fechas is used)
DROP TABLE IF EXISTS tournament_dates CASCADE;

-- Also drop the old couple_availability table if it exists (we need couple_time_availability)
DROP TABLE IF EXISTS couple_availability CASCADE;