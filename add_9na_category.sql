-- ============================================
-- SCRIPT DE MIGRACIÓN: AGREGAR 9NA CATEGORÍA
-- ============================================
--
-- OBJETIVO: Agregar categoría 9na (0-300 puntos) y desplazar todas las demás
-- ESTRATEGIA: Sumar 300 puntos a todos los jugadores para mantenerlos en su categoría relativa
--
-- ORDEN DE EJECUCIÓN:
--   1. Verificación del estado actual
--   2. Inicio de transacción
--   3. Actualización de categorías existentes
--   4. Inserción de nueva categoría 9na
--   5. Actualización de scores de jugadores (+300)
--   6. Recálculo de category_name de jugadores
--   7. Verificación de integridad
--   8. Commit
--
-- ============================================

-- ============================================
-- PASO 1: VERIFICACIÓN DEL ESTADO ACTUAL
-- ============================================
\echo '================================================'
\echo 'PASO 1: Verificando estado actual de categorías'
\echo '================================================'

SELECT 'Estado ANTES de la migración:' as info;

SELECT 'Categorías actuales:' as info;
SELECT name, lower_range, upper_range
FROM categories
ORDER BY lower_range DESC;

SELECT '' as info;
SELECT 'Distribución de jugadores por categoría:' as info;
SELECT
    category_name,
    COUNT(*) as cantidad,
    MIN(score) as score_min,
    MAX(score) as score_max
FROM players
WHERE score IS NOT NULL
GROUP BY category_name
ORDER BY MIN(score) DESC;

SELECT '' as info;
SELECT 'Total de jugadores con score:' as info;
SELECT COUNT(*) as total FROM players WHERE score IS NOT NULL;

-- ============================================
-- PASO 2: INICIO DE TRANSACCIÓN
-- ============================================
\echo ''
\echo '======================================='
\echo 'PASO 2: Iniciando transacción...'
\echo '======================================='

BEGIN;

-- ============================================
-- PASO 3: ACTUALIZAR CATEGORÍAS EXISTENTES
-- ============================================
\echo ''
\echo '========================================================='
\echo 'PASO 3: Actualizando rangos de categorías existentes...'
\echo '========================================================='

-- Actualizar desde la categoría más alta hacia abajo
-- para evitar conflictos de rango

-- Actualizar 6ta: 600-899 → 900-1199
UPDATE categories
SET lower_range = 900, upper_range = 1199
WHERE name = '6ta';

-- Actualizar 7ma: 300-599 → 600-899
UPDATE categories
SET lower_range = 600, upper_range = 899
WHERE name = '7ma';

-- Actualizar 8va: 0-299 → 300-599
UPDATE categories
SET lower_range = 300, upper_range = 599
WHERE name = '8va';

SELECT 'Categorías actualizadas:' as info;
SELECT name, lower_range, upper_range
FROM categories
ORDER BY lower_range DESC;

-- ============================================
-- PASO 4: INSERTAR NUEVA CATEGORÍA 9NA
-- ============================================
\echo ''
\echo '======================================='
\echo 'PASO 4: Insertando categoría 9na...'
\echo '======================================='

INSERT INTO categories (name, lower_range, upper_range)
VALUES ('9na', 0, 299);

SELECT 'Nueva categoría 9na insertada:' as info;
SELECT name, lower_range, upper_range
FROM categories
WHERE name = '9na';

-- ============================================
-- PASO 5: ACTUALIZAR SCORES DE JUGADORES (+300)
-- ============================================
\echo ''
\echo '=================================================='
\echo 'PASO 5: Sumando 300 puntos a todos los jugadores...'
\echo '=================================================='

UPDATE players
SET score = score + 300
WHERE score IS NOT NULL;

SELECT 'Jugadores actualizados con nuevos scores:' as info;
SELECT
    id,
    first_name,
    last_name,
    score as new_score,
    category_name as old_category
FROM players
WHERE score IS NOT NULL
ORDER BY score
LIMIT 10;

-- ============================================
-- PASO 6: RECALCULAR CATEGORY_NAME DE JUGADORES
-- ============================================
\echo ''
\echo '==========================================================='
\echo 'PASO 6: Recalculando category_name según nuevos scores...'
\echo '==========================================================='

-- Actualizar la categoría de cada jugador basándose en su nuevo score
UPDATE players
SET category_name = (
    SELECT name
    FROM categories
    WHERE players.score >= categories.lower_range
      AND (categories.upper_range IS NULL OR players.score <= categories.upper_range)
    ORDER BY lower_range DESC
    LIMIT 1
)
WHERE score IS NOT NULL;

SELECT 'Categorías recalculadas:' as info;
SELECT
    category_name,
    COUNT(*) as cantidad,
    MIN(score) as score_min,
    MAX(score) as score_max
FROM players
WHERE score IS NOT NULL
GROUP BY category_name
ORDER BY MIN(score) DESC;

-- ============================================
-- PASO 7: VERIFICACIÓN DE INTEGRIDAD
-- ============================================
\echo ''
\echo '================================================'
\echo 'PASO 7: Verificando integridad de los datos...'
\echo '================================================'

-- Verificar que todos los jugadores tienen una categoría válida
SELECT 'Jugadores sin categoría después de migración (debería ser 0):' as info;
SELECT COUNT(*) as jugadores_sin_categoria
FROM players
WHERE score IS NOT NULL AND category_name IS NULL;

-- Verificar que no hay jugadores fuera del rango de su categoría
SELECT 'Jugadores fuera del rango de su categoría (debería ser 0):' as info;
SELECT COUNT(*) as jugadores_con_categoria_incorrecta
FROM players p
JOIN categories c ON p.category_name = c.name
WHERE p.score IS NOT NULL
  AND (p.score < c.lower_range OR (c.upper_range IS NOT NULL AND p.score > c.upper_range));

-- Verificar todas las categorías
SELECT 'Todas las categorías en el sistema:' as info;
SELECT name, lower_range, upper_range
FROM categories
ORDER BY lower_range;

-- Distribución final
SELECT '' as info;
SELECT 'DISTRIBUCIÓN FINAL por categoría:' as info;
SELECT
    category_name,
    COUNT(*) as cantidad,
    MIN(score) as score_min,
    MAX(score) as score_max,
    ROUND(AVG(score), 2) as score_promedio
FROM players
WHERE score IS NOT NULL
GROUP BY category_name
ORDER BY MIN(score) DESC;

-- Validación de totales
SELECT '' as info;
SELECT 'VALIDACIÓN: Total de jugadores:' as info;
SELECT COUNT(*) as total_con_score FROM players WHERE score IS NOT NULL;

-- ============================================
-- PASO 8: CONFIRMAR O REVERTIR
-- ============================================
\echo ''
\echo '==========================================='
\echo 'PASO 8: Revisión antes de confirmar...'
\echo '==========================================='
\echo ''
\echo 'REVISA LOS RESULTADOS ARRIBA.'
\echo ''
\echo 'Si todo está correcto, ejecuta: COMMIT;'
\echo 'Si algo está mal, ejecuta: ROLLBACK;'
\echo ''
\echo '==========================================='

-- NO hacer commit automático - permitir revisión manual
-- COMMIT;
