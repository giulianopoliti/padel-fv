-- Create tournament_time_slots table
CREATE TABLE IF NOT EXISTS "public"."tournament_time_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "court_name" "text",
    "max_matches" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Add primary key
ALTER TABLE ONLY "public"."tournament_time_slots"
    ADD CONSTRAINT "tournament_time_slots_pkey" PRIMARY KEY ("id");

-- Add foreign key constraint
ALTER TABLE ONLY "public"."tournament_time_slots"
    ADD CONSTRAINT "tournament_time_slots_fecha_id_fkey" FOREIGN KEY ("fecha_id") REFERENCES "public"."tournament_fechas"("id") ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX "idx_tournament_time_slots_fecha_id" ON "public"."tournament_time_slots" USING "btree" ("fecha_id");
CREATE INDEX "idx_tournament_time_slots_date" ON "public"."tournament_time_slots" USING "btree" ("date");
CREATE INDEX "idx_tournament_time_slots_available" ON "public"."tournament_time_slots" USING "btree" ("is_available") WHERE ("is_available" = true);

-- Add RLS
ALTER TABLE "public"."tournament_time_slots" ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE "public"."tournament_time_slots" IS 'Franjas horarias específicas creadas por organizadores para cada fecha';
COMMENT ON COLUMN "public"."tournament_time_slots"."max_matches" IS 'Número máximo de partidos simultáneos en este horario/cancha';