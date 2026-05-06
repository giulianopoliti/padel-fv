-- Add DRAFT status to match_status enum
-- This allows matches to be created in draft mode and published later

-- Add new DRAFT status to the enum
-- Note: In PostgreSQL, we cannot simply add a value to an existing enum in a specific position
-- We need to use ALTER TYPE ... ADD VALUE which appends to the end
-- The order doesn't affect functionality, only display order

-- IMPORTANT: Cannot use the new enum value in the same transaction where it's created
-- So we split this into two parts

ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'DRAFT';

-- Add comment for documentation
COMMENT ON TYPE match_status IS 'Match status enum: PENDING (published, visible to players), DRAFT (unpublished, only visible to organizers), IN_PROGRESS, COMPLETED, CANCELED, FINISHED, BYE, WAITING_OPONENT';
