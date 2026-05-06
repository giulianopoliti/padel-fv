-- Add AMERICAN_OTP to tournament_type enum
-- This migration adds the third tournament type for single zone American tournaments

-- Add the new value to the existing enum
ALTER TYPE "public"."tournament_type" ADD VALUE 'AMERICAN_OTP';

-- Add comment to document the new tournament type
COMMENT ON TYPE "public"."tournament_type" IS 'Tournament types: AMERICAN (multi-zone), LONG (3-set matches), AMERICAN_OTP (single zone American)';

-- Update the trigger function to handle AMERICAN_OTP tournaments
CREATE OR REPLACE FUNCTION create_default_ranking_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Create config for LONG tournaments
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
    
    -- Create config for AMERICAN_OTP tournaments (single zone American)
    IF NEW.type = 'AMERICAN_OTP' THEN
        INSERT INTO tournament_ranking_config (tournament_id, criteria, name, description, created_by)
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
            'Sistema de ranking estándar para torneo americano de zona única',
            NEW.created_by
        );
    END IF;
    
    -- Note: AMERICAN tournaments do NOT get a config - they use hardcoded legacy system
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;