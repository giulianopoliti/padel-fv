-- Remove created_by field from tournament_ranking_config table
-- This field was causing errors because tournaments table doesn't have created_by field
-- and the trigger function was trying to reference NEW.created_by

-- Drop the foreign key constraint first
ALTER TABLE "public"."tournament_ranking_config" 
    DROP CONSTRAINT IF EXISTS "tournament_ranking_config_created_by_fkey";

-- Drop the created_by column
ALTER TABLE "public"."tournament_ranking_config" 
    DROP COLUMN IF EXISTS "created_by";

-- Update the trigger function to remove created_by references
CREATE OR REPLACE FUNCTION create_default_ranking_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Create config for LONG tournaments
    IF NEW.type = 'LONG' THEN
        INSERT INTO tournament_ranking_config (tournament_id, criteria, name, description)
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
            'Sistema de ranking estándar para torneo largo'
        );
    END IF;
    
    -- Create config for AMERICAN_OTP tournaments (single zone American)
    IF NEW.type = 'AMERICAN_OTP' THEN
        INSERT INTO tournament_ranking_config (tournament_id, criteria, name, description)
        VALUES (
            NEW.id,
            '[
                {"order": 1, "criterion": "wins", "enabled": true, "weight": 1},
                {"order": 2, "criterion": "head_to_head", "enabled": true, "weight": 1},
                {"order": 3, "criterion": "games_difference", "enabled": true, "weight": 1},
                {"order": 4, "criterion": "games_for", "enabled": true, "weight": 1},
                {"order": 5, "criterion": "player_scores", "enabled": true, "weight": 1},
                {"order": 6, "criterion": "random", "enabled": true, "weight": 1}
            ]'::jsonb,
            'Configuración American OTP por Defecto',
            'Sistema de ranking estándar para torneo americano de zona única'
        );
    END IF;
    
    -- Note: AMERICAN tournaments do NOT get a config - they use hardcoded legacy system
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to document the change
COMMENT ON TABLE "public"."tournament_ranking_config" IS 'Stores configurable ranking criteria for tournament position calculations. Created_by field removed to simplify system.';