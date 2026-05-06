-- Script para limpiar TODOS los datos de prueba
-- ⚠️ CUIDADO: Esto eliminará TODOS los registros con es_prueba = true

-- Eliminar en orden para respetar foreign keys

-- 1. Eliminar historiales de jugadores
DELETE FROM player_tournament_history WHERE es_prueba = true;

-- 2. Eliminar snapshots de ranking
DELETE FROM ranking_snapshots WHERE es_prueba = true;

-- 3. Eliminar seeds de torneos
DELETE FROM tournament_couple_seeds WHERE es_prueba = true;

-- 4. Eliminar relaciones zona-parejas
DELETE FROM zone_couples WHERE es_prueba = true;

-- 5. Eliminar partidos
DELETE FROM matches WHERE es_prueba = true;

-- 6. Eliminar zonas
DELETE FROM zones WHERE es_prueba = true;

-- 7. Eliminar inscripciones
DELETE FROM inscriptions WHERE es_prueba = true;

-- 8. Eliminar parejas
DELETE FROM couples WHERE es_prueba = true;

-- 9. Eliminar jugadores
DELETE FROM players WHERE es_prueba = true;

-- 10. Eliminar torneos
DELETE FROM tournaments WHERE es_prueba = true;

-- Verificar limpieza
SELECT 
  'players' as tabla, COUNT(*) as registros_prueba 
FROM players WHERE es_prueba = true
UNION ALL
SELECT 
  'couples' as tabla, COUNT(*) as registros_prueba 
FROM couples WHERE es_prueba = true
UNION ALL
SELECT 
  'tournaments' as tabla, COUNT(*) as registros_prueba 
FROM tournaments WHERE es_prueba = true
UNION ALL
SELECT 
  'matches' as tabla, COUNT(*) as registros_prueba 
FROM matches WHERE es_prueba = true; 