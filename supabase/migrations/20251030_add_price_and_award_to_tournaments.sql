-- Add price and award columns to tournaments table
-- Migration created: 2025-10-30

-- Add price column (string/text to allow flexible formats like "$500" or "Gratis")
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS price TEXT;

-- Add award column (string/text to allow flexible formats like "$1000" or "Trofeo + $500")
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS award TEXT;

-- Add comments for documentation
COMMENT ON COLUMN tournaments.price IS 'Entry price for the tournament (can be formatted as text, e.g., "$500" or "Gratis")';
COMMENT ON COLUMN tournaments.award IS 'Prize/award for the tournament (can be formatted as text, e.g., "$1000" or "Trofeo + $500")';
