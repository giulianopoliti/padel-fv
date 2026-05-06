-- Insert default ranking configurations for AMERICAN_OTP tournaments
-- This runs after the enum value has been created in the previous migration

-- Insert default configuration for existing AMERICAN_OTP tournaments (if any)
INSERT INTO "public"."tournament_ranking_config" (tournament_id, criteria, name, description)
SELECT 
    t.id,
    '[
        {"order": 1, "criterion": "wins", "enabled": true, "weight": 1},
        {"order": 2, "criterion": "head_to_head", "enabled": true, "weight": 1},
        {"order": 3, "criterion": "games_difference", "enabled": true, "weight": 1},
        {"order": 4, "criterion": "games_for", "enabled": true, "weight": 1},
        {"order": 5, "criterion": "player_scores", "enabled": true, "weight": 1},
        {"order": 6, "criterion": "random", "enabled": true, "weight": 1}
    ]'::jsonb,
    'Configuración American OTP por Defecto',
    'Sistema de ranking para torneo americano de una sola zona: partidos ganados, enfrentamiento directo, diferencia de games, games ganados, puntaje jugadores'
FROM tournaments t 
WHERE t.type = 'AMERICAN_OTP' 
AND NOT EXISTS (
    SELECT 1 FROM tournament_ranking_config trc 
    WHERE trc.tournament_id = t.id
);