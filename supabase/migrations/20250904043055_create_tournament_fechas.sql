-- Create tournament_fechas table
CREATE TABLE IF NOT EXISTS "public"."tournament_fechas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "fecha_number" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date",
    "end_date" "date",
    "status" "public"."fecha_status" DEFAULT 'NOT_STARTED'::"public"."fecha_status" NOT NULL,
    "is_qualifying" boolean DEFAULT false NOT NULL,
    "max_matches_per_couple" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Add primary key and constraints
ALTER TABLE ONLY "public"."tournament_fechas"
    ADD CONSTRAINT "tournament_fechas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tournament_fechas"
    ADD CONSTRAINT "unique_fecha_per_tournament" UNIQUE ("tournament_id", "fecha_number");

-- Add foreign key constraint
ALTER TABLE ONLY "public"."tournament_fechas"
    ADD CONSTRAINT "tournament_fechas_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX "idx_tournament_fechas_tournament_id" ON "public"."tournament_fechas" USING "btree" ("tournament_id");
CREATE INDEX "idx_tournament_fechas_status" ON "public"."tournament_fechas" USING "btree" ("status");
CREATE INDEX "idx_tournament_fechas_date_range" ON "public"."tournament_fechas" USING "btree" ("start_date", "end_date");

-- Add RLS
ALTER TABLE "public"."tournament_fechas" ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE "public"."tournament_fechas" IS 'Fechas conceptuales del torneo (Fecha 1, Cuartos, etc.) - Sistema escalable para torneos largos';
COMMENT ON COLUMN "public"."tournament_fechas"."fecha_number" IS 'Número secuencial de la fecha (1, 2, 3...)';
COMMENT ON COLUMN "public"."tournament_fechas"."is_qualifying" IS 'True para fases clasificatorias, false para eliminación directa';
COMMENT ON COLUMN "public"."tournament_fechas"."max_matches_per_couple" IS 'Límite de partidos por pareja en esta fecha específica';