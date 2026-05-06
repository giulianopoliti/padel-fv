-- Create set_matches table with enhanced structure from backup
CREATE TABLE IF NOT EXISTS "public"."set_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "match_id" "uuid" NOT NULL,
    "set_number" smallint NOT NULL,
    "couple1_games" smallint DEFAULT 0 NOT NULL,
    "couple2_games" smallint DEFAULT 0 NOT NULL,
    "winner_couple_id" "uuid",
    "status" "text" DEFAULT 'COMPLETED'::"text",
    "duration_minutes" smallint,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Add constraints
ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_match_id_set_number_key" UNIQUE ("match_id", "set_number");

-- Add check constraints
ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_couple1_games_check" CHECK (("couple1_games" >= 0));

ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_couple2_games_check" CHECK (("couple2_games" >= 0));

ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_set_number_check" CHECK ((("set_number" >= 1) AND ("set_number" <= 5)));

ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text", 'WALKOVER'::"text"])));

-- Add foreign key constraints
ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."set_matches"
    ADD CONSTRAINT "set_matches_winner_couple_id_fkey" FOREIGN KEY ("winner_couple_id") REFERENCES "public"."couples"("id");

-- Add indexes
CREATE INDEX "idx_set_matches_match_id" ON "public"."set_matches" USING "btree" ("match_id");
CREATE INDEX "idx_set_matches_status" ON "public"."set_matches" USING "btree" ("status");
CREATE INDEX "idx_set_matches_winner" ON "public"."set_matches" USING "btree" ("winner_couple_id");

-- Add RLS
ALTER TABLE "public"."set_matches" ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE "public"."set_matches" IS 'Stores individual set results for matches. Supports both single-set (american qually) and multi-set (long tournaments) formats';
COMMENT ON COLUMN "public"."set_matches"."set_number" IS 'Set number (1-5). For single-set formats, always use 1';
COMMENT ON COLUMN "public"."set_matches"."couple1_games" IS 'Games won by couple1 in this set';
COMMENT ON COLUMN "public"."set_matches"."couple2_games" IS 'Games won by couple2 in this set';
COMMENT ON COLUMN "public"."set_matches"."winner_couple_id" IS 'Winner of this specific set';
COMMENT ON COLUMN "public"."set_matches"."duration_minutes" IS 'Optional duration tracking for analytics';
COMMENT ON COLUMN "public"."set_matches"."notes" IS 'Optional notes for incidents, walkovers, etc';