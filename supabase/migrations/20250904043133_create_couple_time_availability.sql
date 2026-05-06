-- Create couple_time_availability table
CREATE TABLE IF NOT EXISTS "public"."couple_time_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "time_slot_id" "uuid" NOT NULL,
    "is_available" boolean DEFAULT false NOT NULL,
    "preferred_start_time" time without time zone,
    "preferred_end_time" time without time zone,
    "can_start_earlier" boolean DEFAULT false NOT NULL,
    "can_finish_later" boolean DEFAULT false NOT NULL,
    "minimum_duration_minutes" integer DEFAULT 90,
    "priority_level" integer DEFAULT 3,
    "flexibility_level" "text" DEFAULT 'NORMAL'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Add constraints
ALTER TABLE ONLY "public"."couple_time_availability"
    ADD CONSTRAINT "couple_time_availability_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."couple_time_availability"
    ADD CONSTRAINT "unique_couple_time_slot" UNIQUE ("couple_id", "time_slot_id");

-- Add foreign key constraints  
ALTER TABLE ONLY "public"."couple_time_availability"
    ADD CONSTRAINT "couple_time_availability_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."couple_time_availability"
    ADD CONSTRAINT "couple_time_availability_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "public"."tournament_time_slots"("id") ON DELETE CASCADE;

-- Add indexes
CREATE INDEX "idx_couple_availability_couple_id" ON "public"."couple_time_availability" USING "btree" ("couple_id");
CREATE INDEX "idx_couple_availability_time_slot" ON "public"."couple_time_availability" USING "btree" ("time_slot_id");
CREATE INDEX "idx_couple_availability_available" ON "public"."couple_time_availability" USING "btree" ("is_available") WHERE ("is_available" = true);
CREATE INDEX "idx_couple_availability_priority" ON "public"."couple_time_availability" USING "btree" ("priority_level" DESC);

-- Add RLS
ALTER TABLE "public"."couple_time_availability" ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE "public"."couple_time_availability" IS 'Sistema flexible de disponibilidad - parejas marcan preferencias dentro de slots';
COMMENT ON COLUMN "public"."couple_time_availability"."preferred_start_time" IS 'Hora preferida de inicio dentro del slot disponible';
COMMENT ON COLUMN "public"."couple_time_availability"."preferred_end_time" IS 'Hora preferida de finalización dentro del slot';
COMMENT ON COLUMN "public"."couple_time_availability"."priority_level" IS 'Prioridad de este horario para la pareja (1-5)';
COMMENT ON COLUMN "public"."couple_time_availability"."flexibility_level" IS 'Nivel de flexibilidad horaria de la pareja';