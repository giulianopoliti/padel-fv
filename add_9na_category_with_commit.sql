-- ============================================
-- SCRIPT DE MIGRACIÓN: AGREGAR 9NA CATEGORÍA (CON COMMIT AUTOMÁTICO)
-- ============================================

BEGIN;

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

-- Insertar nueva categoría 9na
INSERT INTO categories (name, lower_range, upper_range)
VALUES ('9na', 0, 299);

-- Sumar 300 puntos a todos los jugadores
UPDATE players
SET score = score + 300
WHERE score IS NOT NULL;

-- Recalcular category_name según nuevos scores
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

COMMIT;

-- Verificación final
SELECT 'MIGRACIÓN COMPLETADA' as status;

SELECT 'Categorías finales:' as info;
SELECT name, lower_range, upper_range
FROM categories
ORDER BY lower_range;

SELECT '' as space;
SELECT 'Distribución de jugadores:' as info;
SELECT
    category_name,
    COUNT(*) as cantidad,
    MIN(score) as score_min,
    MAX(score) as score_max
FROM players
WHERE score IS NOT NULL
GROUP BY category_name
ORDER BY MIN(score) DESC;
