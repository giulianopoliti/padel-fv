-- Create fecha_matches table
CREATE TABLE IF NOT EXISTS "public"."fecha_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha_id" "uuid" NOT NULL,
    "match_id" "uuid" NOT NULL,
    "scheduled_time_slot_id" "uuid",
    "match_order" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Add constraints
ALTER TABLE ONLY "public"."fecha_matches"
    ADD CONSTRAINT "fecha_matches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."fecha_matches"
    ADD CONSTRAINT "unique_match_in_fecha" UNIQUE ("match_id");

ALTER TABLE ONLY "public"."fecha_matches"
    ADD CONSTRAINT "positive_match_order" CHECK ((("match_order" IS NULL) OR ("match_order" > 0)));

-- Add foreign key constraints
ALTER TABLE ONLY "public"."fecha_matches"
    ADD CONSTRAINT "fecha_matches_fecha_id_fkey" FOREIGN KEY ("fecha_id") REFERENCES "public"."tournament_fechas"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."fecha_matches"
    ADD CONSTRAINT "fecha_matches_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."fecha_matches"
    ADD CONSTRAINT "fecha_matches_scheduled_time_slot_id_fkey" FOREIGN KEY ("scheduled_time_slot_id") REFERENCES "public"."tournament_time_slots"("id") ON DELETE SET NULL;

-- Add indexes
CREATE INDEX "idx_fecha_matches_fecha_id" ON "public"."fecha_matches" USING "btree" ("fecha_id");
CREATE INDEX "idx_fecha_matches_match_id" ON "public"."fecha_matches" USING "btree" ("match_id");
CREATE INDEX "idx_fecha_matches_time_slot" ON "public"."fecha_matches" USING "btree" ("scheduled_time_slot_id");

-- Add RLS
ALTER TABLE "public"."fecha_matches" ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE "public"."fecha_matches" IS 'Vincula partidos con fechas y opcionalmente con horarios específicos';
COMMENT ON COLUMN "public"."fecha_matches"."scheduled_time_slot_id" IS 'Horario asignado (NULL = sin programar aún)';