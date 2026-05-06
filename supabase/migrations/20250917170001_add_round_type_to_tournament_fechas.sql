-- Migration: Add round_type to tournament_fechas for long tournament bracket management
-- This allows us to categorize fechas by their tournament round (ZONE, 8VOS, 4TOS, etc.)

-- Add round_type column to tournament_fechas using existing ROUND enum
ALTER TABLE "public"."tournament_fechas"
ADD COLUMN "round_type" "public"."ROUND" DEFAULT 'ZONE'::"public"."ROUND";

-- Add index for performance when filtering by round_type
CREATE INDEX "idx_tournament_fechas_round_type"
ON "public"."tournament_fechas" USING "btree" ("round_type");

-- Add composite index for tournament_id + round_type (common query pattern)
CREATE INDEX "idx_tournament_fechas_tournament_round"
ON "public"."tournament_fechas" USING "btree" ("tournament_id", "round_type");

-- Add comment for documentation
COMMENT ON COLUMN "public"."tournament_fechas"."round_type"
IS 'Tournament round type: ZONE for qualifying phases, others for elimination rounds';

-- Update existing data: mark all existing fechas as ZONE (qualifying) by default
-- This is safe since existing tournaments are likely using the qually system
UPDATE "public"."tournament_fechas"
SET "round_type" = 'ZONE'::"public"."ROUND"
WHERE "round_type" IS NULL;

-- Make the column NOT NULL after updating existing data
ALTER TABLE "public"."tournament_fechas"
ALTER COLUMN "round_type" SET NOT NULL;