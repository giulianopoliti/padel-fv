-- Create tournament_ranking_config table for configurable position ranking
-- This table stores the ranking criteria configuration for each tournament
-- allowing flexible and customizable position calculation systems

-- Create the main configuration table
CREATE TABLE IF NOT EXISTS "public"."tournament_ranking_config" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "tournament_id" uuid NOT NULL,
    "criteria" jsonb NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "name" text DEFAULT 'Default Configuration' NOT NULL,
    "description" text
);

-- Add primary key constraint
ALTER TABLE ONLY "public"."tournament_ranking_config"
    ADD CONSTRAINT "tournament_ranking_config_pkey" PRIMARY KEY ("id");

-- Add foreign key constraints
ALTER TABLE ONLY "public"."tournament_ranking_config"
    ADD CONSTRAINT "tournament_ranking_config_tournament_id_fkey" 
    FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tournament_ranking_config"
    ADD CONSTRAINT "tournament_ranking_config_created_by_fkey" 
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- Add unique constraint to ensure only one active config per tournament
ALTER TABLE ONLY "public"."tournament_ranking_config"
    ADD CONSTRAINT "tournament_ranking_config_unique_active" 
    UNIQUE ("tournament_id", "is_active") DEFERRABLE INITIALLY DEFERRED;

-- Create indexes for performance
CREATE INDEX "idx_tournament_ranking_config_tournament_id" 
    ON "public"."tournament_ranking_config" USING btree ("tournament_id");

CREATE INDEX "idx_tournament_ranking_config_active" 
    ON "public"."tournament_ranking_config" USING btree ("tournament_id", "is_active") 
    WHERE "is_active" = true;

-- Add check constraint for valid criteria structure
ALTER TABLE ONLY "public"."tournament_ranking_config"
    ADD CONSTRAINT "tournament_ranking_config_criteria_check" 
    CHECK (jsonb_typeof(criteria) = 'array'::text);

-- Enable RLS
ALTER TABLE "public"."tournament_ranking_config" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view ranking configs for accessible tournaments" 
    ON "public"."tournament_ranking_config" FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t 
            WHERE t.id = tournament_ranking_config.tournament_id 
            AND (
                -- Tournament belongs to user's club
                t.club_id IN (
                    SELECT c.id FROM clubes c 
                    WHERE c.user_id = auth.uid()
                ) 
                -- Tournament belongs to user's organization
                OR t.organization_id IN (
                    SELECT om.organizacion_id FROM organization_members om 
                    WHERE om.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Club owners and organization members can manage ranking configs" 
    ON "public"."tournament_ranking_config" FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t 
            WHERE t.id = tournament_ranking_config.tournament_id 
            AND (
                -- Tournament belongs to user's club (club owner)
                t.club_id IN (
                    SELECT c.id FROM clubes c 
                    WHERE c.user_id = auth.uid()
                ) 
                -- Tournament belongs to user's organization
                OR t.organization_id IN (
                    SELECT om.organizacion_id FROM organization_members om 
                    WHERE om.user_id = auth.uid()
                )
            )
        )
    );

-- Add comments for documentation
COMMENT ON TABLE "public"."tournament_ranking_config" IS 'Stores configurable ranking criteria for tournament position calculations';
COMMENT ON COLUMN "public"."tournament_ranking_config"."criteria" IS 'JSON array of ranking criteria with order, type, and configuration';
COMMENT ON COLUMN "public"."tournament_ranking_config"."is_active" IS 'Only one active configuration per tournament allowed';
COMMENT ON COLUMN "public"."tournament_ranking_config"."name" IS 'Human-readable name for the configuration';
COMMENT ON COLUMN "public"."tournament_ranking_config"."description" IS 'Optional description of the ranking strategy';

-- Insert default configuration for existing tournaments with type 'LONG'
INSERT INTO "public"."tournament_ranking_config" (tournament_id, criteria, name, description)
SELECT 
    t.id,
    '[
        {"order": 1, "criterion": "wins", "enabled": true, "weight": 1},
        {"order": 2, "criterion": "sets_difference", "enabled": true, "weight": 1},
        {"order": 3, "criterion": "games_difference", "enabled": true, "weight": 1},
        {"order": 4, "criterion": "head_to_head", "enabled": true, "weight": 1},
        {"order": 5, "criterion": "sets_for", "enabled": true, "weight": 1},
        {"order": 6, "criterion": "games_for", "enabled": true, "weight": 1},
        {"order": 7, "criterion": "random", "enabled": true, "weight": 1}
    ]'::jsonb,
    'Configuración por Defecto',
    'Sistema de ranking estándar: partidos ganados, diferencia de sets, diferencia de games, enfrentamiento directo, sets ganados, games ganados'
FROM tournaments t 
WHERE t.type = 'LONG' 
AND NOT EXISTS (
    SELECT 1 FROM tournament_ranking_config trc 
    WHERE trc.tournament_id = t.id
);

-- Create function to automatically create default config for new LONG tournaments
CREATE OR REPLACE FUNCTION create_default_ranking_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create config for LONG tournaments
    IF NEW.type = 'LONG' THEN
        INSERT INTO tournament_ranking_config (tournament_id, criteria, name, description, created_by)
        VALUES (
            NEW.id,
            '[
                {"order": 1, "criterion": "wins", "enabled": true, "weight": 1},
                {"order": 2, "criterion": "sets_difference", "enabled": true, "weight": 1},
                {"order": 3, "criterion": "games_difference", "enabled": true, "weight": 1},
                {"order": 4, "criterion": "head_to_head", "enabled": true, "weight": 1},
                {"order": 5, "criterion": "sets_for", "enabled": true, "weight": 1},
                {"order": 6, "criterion": "games_for", "enabled": true, "weight": 1},
                {"order": 7, "criterion": "random", "enabled": true, "weight": 1}
            ]'::jsonb,
            'Configuración por Defecto',
            'Sistema de ranking estándar para torneo largo',
            NEW.created_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create default configs
CREATE TRIGGER trigger_create_default_ranking_config
    AFTER INSERT ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION create_default_ranking_config();