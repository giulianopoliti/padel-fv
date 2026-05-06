-- Add qualifying advancement settings to tournament_ranking_config
-- This allows tournaments to configure how many couples advance from qualifying phase

ALTER TABLE tournament_ranking_config
ADD COLUMN qualifying_advancement_settings jsonb
DEFAULT '{"enabled": false, "couples_advance": null}'::jsonb;

-- Add comment to document the field
COMMENT ON COLUMN tournament_ranking_config.qualifying_advancement_settings IS
'JSON configuration for qualifying phase advancement rules. Structure: {"enabled": boolean, "couples_advance": number}';

-- Update existing records with default settings
UPDATE tournament_ranking_config
SET qualifying_advancement_settings = '{"enabled": false, "couples_advance": null}'::jsonb
WHERE qualifying_advancement_settings IS NULL;