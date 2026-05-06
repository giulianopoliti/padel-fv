-- ============================================
-- MIGRACIÓN: AGREGAR 9NA CATEGORÍA
-- ============================================
-- Fecha: 2025-11-07
-- Descripción: Agrega la categoría 9na (0-300 puntos) y desplaza todas las demás.
--              Suma 300 puntos a todos los jugadores para mantenerlos en su categoría relativa.
--
-- IMPACTO:
--   - Se crea la categoría 9na (0-299 puntos)
--   - Se desplazan todas las categorías existentes +300 puntos en su rango
--   - Se suman 300 puntos a todos los scores de jugadores (con score IS NOT NULL)
--   - Se recalculan las asignaciones de category_name SOLO para jugadores con is_categorized=true
--   - Jugadores con is_categorized=false mantienen su estado sin categoría
--
-- ROLLBACK: Si es necesario revertir, ejecutar manualmente:
--   BEGIN;
--   UPDATE players SET score = score - 300 WHERE score IS NOT NULL;
--   UPDATE players SET category_name = (
--     SELECT name FROM categories
--     WHERE players.score >= categories.lower_range
--       AND (categories.upper_range IS NULL OR players.score <= categories.upper_range)
--     ORDER BY lower_range DESC LIMIT 1
--   ) WHERE score IS NOT NULL AND is_categorized = true;
--   DELETE FROM categories WHERE name = '9na';
--   -- Restaurar rangos anteriores de 8va, 7ma, 6ta, etc.
--   COMMIT;
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Actualizar rangos de categorías existentes
-- ============================================

-- Actualizar desde la categoría más alta hacia abajo
-- para evitar conflictos de rango
-- actualizar 1ra categoria
UPDATE categories
SET lower_range = 2400
WHERE name = '1ra';
-- actualizar 2da categoria
UPDATE categories
SET lower_range = 2100, upper_range = 2399
WHERE name = '2da';
-- actualizar 3ra categoria
UPDATE categories
SET lower_range = 1800, upper_range = 2099
WHERE name = '3ra';
-- actualizar 4ta categoria
UPDATE categories
SET lower_range = 1500, upper_range = 1799
WHERE name = '4ta';
-- actualizar 5ta categoria
UPDATE categories
SET lower_range = 1200, upper_range = 1499
WHERE name = '5ta';
-- actualizar 6ta categoria
UPDATE categories
SET lower_range = 900, upper_range = 1199
WHERE name = '6ta';
-- actualizar 7ma categoria
UPDATE categories
SET lower_range = 600, upper_range = 899
WHERE name = '7ma';
-- actualizar 8va categoria
UPDATE categories
SET lower_range = 300, upper_range = 599
WHERE name = '8va';
-- ============================================
-- PASO 2: Insertar nueva categoría 9na
-- ============================================

INSERT INTO categories (name, lower_range, upper_range)
VALUES ('9na', 0, 299);

-- ============================================
-- PASO 3: Sumar 300 puntos a todos los jugadores
-- ============================================

UPDATE players
SET score = score + 300
WHERE score IS NOT NULL;

-- ============================================
-- PASO 4: Recalcular category_name de jugadores
-- ============================================

-- Actualizar la categoría SOLO de jugadores que ya están categorizados
-- Los jugadores con is_categorized=false se mantienen sin categoría
UPDATE players
SET category_name = (
    SELECT name
    FROM categories
    WHERE players.score >= categories.lower_range
      AND (categories.upper_range IS NULL OR players.score <= categories.upper_range)
    ORDER BY lower_range DESC
    LIMIT 1
)
WHERE score IS NOT NULL
  AND is_categorized = true;

-- ============================================
-- VERIFICACIÓN DE INTEGRIDAD
-- ============================================

-- Verificar que no hay jugadores CATEGORIZADOS sin categoría
-- Los jugadores con is_categorized=false pueden no tener categoría
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM players
    WHERE score IS NOT NULL
      AND category_name IS NULL
      AND is_categorized = true;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Hay % jugadores categorizados sin categoría después de la migración', orphan_count;
    END IF;

    RAISE NOTICE 'Verificación de integridad: OK - Todos los jugadores categorizados tienen categoría';
END $$;

-- Verificar que no hay jugadores fuera del rango de su categoría
DO $$
DECLARE
    mismatch_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM players p
    JOIN categories c ON p.category_name = c.name
    WHERE p.score IS NOT NULL
      AND (p.score < c.lower_range OR (c.upper_range IS NOT NULL AND p.score > c.upper_range));

    IF mismatch_count > 0 THEN
        RAISE EXCEPTION 'Hay % jugadores fuera del rango de su categoría', mismatch_count;
    END IF;

    RAISE NOTICE 'Verificación de rangos: OK - Todos los jugadores están en su categoría correcta';
END $$;

COMMIT;

-- ============================================
-- RESUMEN DE LA MIGRACIÓN
-- ============================================

SELECT 'MIGRACIÓN COMPLETADA EXITOSAMENTE' as status;

SELECT '' as separator;
SELECT 'Categorías finales:' as info;
SELECT name, lower_range, upper_range
FROM categories
ORDER BY lower_range;

SELECT '' as separator;
SELECT 'Estadísticas de jugadores:' as info;
SELECT
    COUNT(*) as total_jugadores,
    COUNT(CASE WHEN score IS NOT NULL THEN 1 END) as jugadores_con_score,
    COUNT(CASE WHEN is_categorized = true THEN 1 END) as jugadores_categorizados,
    COUNT(CASE WHEN is_categorized = false THEN 1 END) as jugadores_no_categorizados,
    COUNT(CASE WHEN score IS NOT NULL AND category_name IS NOT NULL THEN 1 END) as jugadores_con_categoria_asignada,
    COUNT(CASE WHEN score IS NOT NULL AND category_name IS NULL THEN 1 END) as jugadores_con_score_sin_categoria
FROM players;

SELECT '' as separator;
SELECT 'Distribución por categoría:' as info;
SELECT
    COALESCE(p.category_name, 'SIN CATEGORÍA') as categoria,
    COUNT(*) as cantidad_jugadores,
    ROUND(AVG(p.score), 2) as promedio_score,
    MIN(p.score) as min_score,
    MAX(p.score) as max_score
FROM players p
LEFT JOIN categories c ON p.category_name = c.name
GROUP BY p.category_name, c.lower_range
ORDER BY c.lower_range NULLS LAST;
