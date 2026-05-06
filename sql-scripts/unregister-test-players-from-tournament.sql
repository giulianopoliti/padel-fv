-- Script para DES-INSCRIBIR todos los jugadores de prueba del torneo específico
-- ⚠️ CUIDADO: Esto eliminará todas las inscripciones de prueba de este torneo
-- Torneo ID: 02b2447d-f9cb-4ca9-a673-ab8369e845d2

-- Primero, ver cuántos jugadores de prueba están inscritos
SELECT 
  COUNT(*) as jugadores_a_eliminar,
  'Jugadores de prueba que serán des-inscritos' as descripcion
FROM inscriptions 
WHERE tournament_id = '02b2447d-f9cb-4ca9-a673-ab8369e845d2' 
  AND es_prueba = true;

-- Eliminar todas las inscripciones de jugadores de prueba
DELETE FROM inscriptions 
WHERE tournament_id = '02b2447d-f9cb-4ca9-a673-ab8369e845d2' 
  AND es_prueba = true;

-- Verificar que se eliminaron correctamente
SELECT 
  COUNT(*) as jugadores_restantes,
  'Jugadores de prueba que quedan inscritos (debería ser 0)' as descripcion
FROM inscriptions 
WHERE tournament_id = '02b2447d-f9cb-4ca9-a673-ab8369e845d2' 
  AND es_prueba = true; 