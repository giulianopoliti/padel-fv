-- Add club_id column to matches table
ALTER TABLE "public"."matches"
ADD COLUMN "club_id" "uuid";

-- Add foreign key constraint
ALTER TABLE "public"."matches"
ADD CONSTRAINT "matches_club_id_fkey"
FOREIGN KEY ("club_id")
REFERENCES "public"."clubes"("id")
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX "idx_matches_club_id" ON "public"."matches" USING "btree" ("club_id");

-- Add comment
COMMENT ON COLUMN "public"."matches"."club_id" IS 'Club donde se juega el partido (opcional)';
