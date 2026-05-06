-- Script para inscribir todos los jugadores de prueba al torneo específico
-- Torneo ID: 02b2447d-f9cb-4ca9-a673-ab8369e845d2

-- Inscribir todos los jugadores de prueba que no estén ya inscritos
INSERT INTO inscriptions (
  player_id,
  tournament_id,
  es_prueba,
  is_pending,
  created_at
)
SELECT 
  p.id as player_id,
  '02b2447d-f9cb-4ca9-a673-ab8369e845d2' as tournament_id,
  true as es_prueba,
  false as is_pending,
  NOW() as created_at
FROM players p
WHERE p.es_prueba = true
  AND NOT EXISTS (
    -- Evitar duplicados: solo inscribir si no está ya inscrito
    SELECT 1 
    FROM inscriptions i 
    WHERE i.player_id = p.id 
      AND i.tournament_id = '02b2447d-f9cb-4ca9-a673-ab8369e845d2'
  );

-- Verificar cuántos jugadores se inscribieron
SELECT 
  COUNT(*) as total_jugadores_inscritos,
  'Jugadores de prueba inscritos en el torneo' as descripcion
FROM inscriptions 
WHERE tournament_id = '02b2447d-f9cb-4ca9-a673-ab8369e845d2' 
  AND es_prueba = true;

-- Ver los jugadores inscritos con sus nombres
SELECT 
  p.first_name,
  p.last_name,
  p.dni,
  i.created_at as fecha_inscripcion
FROM inscriptions i
JOIN players p ON p.id = i.player_id
WHERE i.tournament_id = '02b2447d-f9cb-4ca9-a673-ab8369e845d2'
  AND i.es_prueba = true
ORDER BY p.first_name, p.last_name; 