-- Migration: Add is_eliminated field to inscriptions table
-- This tracks which couples have been eliminated from the tournament

-- Add is_eliminated column to inscriptions
ALTER TABLE "public"."inscriptions"
ADD COLUMN "is_eliminated" BOOLEAN DEFAULT FALSE NOT NULL;

-- Add eliminated_at timestamp for tracking when elimination occurred
ALTER TABLE "public"."inscriptions"
ADD COLUMN "eliminated_at" TIMESTAMP WITH TIME ZONE NULL;

-- Add eliminated_in_round to track which round the elimination happened
ALTER TABLE "public"."inscriptions"
ADD COLUMN "eliminated_in_round" "public"."ROUND" NULL;

-- Add index for performance when filtering by elimination status
CREATE INDEX "idx_inscriptions_elimination_status"
ON "public"."inscriptions" USING "btree" ("tournament_id", "is_eliminated");

-- Add index for eliminated_at for chronological queries
CREATE INDEX "idx_inscriptions_eliminated_at"
ON "public"."inscriptions" USING "btree" ("eliminated_at")
WHERE "eliminated_at" IS NOT NULL;

-- Add composite index for tournament + round elimination tracking
CREATE INDEX "idx_inscriptions_tournament_round_elimination"
ON "public"."inscriptions" USING "btree" ("tournament_id", "eliminated_in_round", "is_eliminated");

-- Add comments for documentation
COMMENT ON COLUMN "public"."inscriptions"."is_eliminated"
IS 'Indicates if the couple has been eliminated from the tournament';

COMMENT ON COLUMN "public"."inscriptions"."eliminated_at"
IS 'Timestamp when the couple was eliminated from the tournament';

COMMENT ON COLUMN "public"."inscriptions"."eliminated_in_round"
IS 'The tournament round where the elimination occurred';

-- Add check constraint to ensure eliminated_at is set when is_eliminated is true
ALTER TABLE "public"."inscriptions"
ADD CONSTRAINT "elimination_timestamp_consistency"
CHECK (
  (is_eliminated = FALSE AND eliminated_at IS NULL AND eliminated_in_round IS NULL) OR
  (is_eliminated = TRUE AND eliminated_at IS NOT NULL)
);