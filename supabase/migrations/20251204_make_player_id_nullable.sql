-- Migration: Make player_id nullable in inscriptions table
-- Date: 2024-12-04
-- Description: This allows organizer registrations to have null player_id
-- When organizer registers a couple: player_id = null
-- When player registers themselves: player_id = player's id

ALTER TABLE inscriptions ALTER COLUMN player_id DROP NOT NULL;

