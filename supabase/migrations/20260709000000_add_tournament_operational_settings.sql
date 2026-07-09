-- Add operational settings for tournament runtime behavior.
-- The first flag lets LONG tournaments generate brackets using the current standings
-- without requiring every couple to have completed the configured zone matches.

ALTER TABLE "public"."tournament_ranking_config"
ADD COLUMN IF NOT EXISTS "operational_settings" jsonb
DEFAULT '{"enforceLongBracketMatchRequirement": true}'::jsonb;

COMMENT ON COLUMN "public"."tournament_ranking_config"."operational_settings" IS
'JSON configuration for operational tournament behavior. Structure: {"enforceLongBracketMatchRequirement": boolean}';

UPDATE "public"."tournament_ranking_config"
SET "operational_settings" = COALESCE("operational_settings", '{}'::jsonb) ||
  '{"enforceLongBracketMatchRequirement": true}'::jsonb
WHERE NOT COALESCE("operational_settings", '{}'::jsonb) ? 'enforceLongBracketMatchRequirement';
